import { CALLS_LIMIT, getStepDef } from "@/lib/constants/step-registry";

/**
 * P08 — lời nhắn ở cổng chốt mà bước hiện tại KHÔNG xử lý được thì đi đường "Sửa tài liệu" (xem trước + Áp dụng) thay vì
 * gửi thành `revision` của bước rồi bị nuốt:
 * - `callLimit` (BarberGo #9): bước đã dùng hết 8 lượt gọi AI — revision chắc chắn bị từ chối.
 * - `otherSection` (FLF-413 #11): lệnh nhắm một mục mà bước không ghi (ở S-7.4 "thêm thông báo vào mục 5.3") — AI của bước
 *   chỉ trả lời "sẽ xử lý ở phần thông báo" và lệnh bị bỏ.
 */
export type GateEditRoute = "callLimit" | "otherSection";

/** Mục cố định của mẫu FPT ⇒ collection Spine nuôi mục (bản thu gọn bảng §4 của BE `section-registry.ts`). */
const SECTION_COLLECTIONS: Readonly<Record<string, readonly string[]>> = {
  "1": ["project"],
  "2.1": ["actors"],
  "2.2": ["use_cases"],
  "2.2.1": ["use_cases", "actors"],
  "2.2.2": ["use_cases"],
  "3.1.1": ["screens"],
  "3.1.2": ["screens"],
  "3.1.3": ["permissions", "roles"],
  "3.1.4": ["functions"],
  "3.1.5": ["entities"],
  "4.1": ["nfrs"],
  "4.2": ["nfrs"],
  "4.2.1": ["nfrs"],
  "4.2.2": ["nfrs"],
  "4.2.3": ["nfrs"],
  "4.2.4": ["nfrs"],
  "5.1": ["business_rules"],
  "5.2": ["common_requirements"],
  "5.3": ["messages"],
  "5.4": ["other_requirements"],
  "5.5": ["glossary"],
};

const SECTION_MENTION = /(?:§|(?<!\p{L})(?:mục|muc|phần|phan|section))\s*(\d+(?:\.\d+)*)/giu;
const EDIT_VERB_SRC = "thêm|them|bổ sung|bo sung|sửa|sua|đổi|doi|xoá|xóa|xoa|bỏ|cập nhật|cap nhat|ghi|add|change|edit|remove|delete|update|rename";
/** Số từ đầu câu mà động từ sửa còn được coi là "mở lệnh" (giống `isChangeInstruction` của BE). */
const VERB_WINDOW = 4;
/** Tên loại phần tử / số mục phải nằm gần sau động từ mới là tân ngữ của nó. */
const OBJECT_WINDOW = 6;

/** Cụm thu hẹp phạm vi bản phát hành ("bỏ hai nhóm …", "để bản sau", "không làm … ở bản 1.0", "drop … from release"). */
const SCOPE_NARROWING: readonly RegExp[] = [
  /(?<!\p{L})(?:bỏ|bo|loại|loai|cắt|cat)\s+(?:\p{L}+\s+)?(?:nhóm|nhom|vai trò|vai tro|phân hệ|phan he|module|chức năng|chuc nang)(?!\p{L})/iu,
  /(?<!\p{L})(?:để|de|dời|doi|hoãn|hoan)\s+(?:lại\s+|lai\s+)?(?:(?:sang|qua|cho|ở|o)\s+)?(?:bản|ban|phiên bản|phien ban|đợt|dot)\s+(?:sau|tới|toi|kế|ke|2|\d+\.\d+)/iu,
  /(?<!\p{L})không\s+(?:làm|lam).*(?:bản|ban)\s+\d+(?:\.\d+)?/iu,
  /(?<!\p{L})(?:drop|defer|postpone|cut).*(?:from|to)\s+(?:the\s+)?(?:release|v\d|next)/iu,
];
/** Bước ghi các collection này thì tự xử lý được lệnh đổi phạm vi. */
const SCOPE_COLLECTIONS = ["use_cases", "project", "release_scope"];

const words = (clause: string): string[] => clause.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}.]/gu, "")).filter(Boolean);

/** Tách thành câu / dòng; số thứ tự "1." đầu dòng và dấu chấm trong số ("5.3", "1.0") không phải ranh giới câu. */
const clausesOf = (text: string): string[] =>
  text
    .split(/\r?\n|(?<=[\p{L})"”])[.!?;]+\s+/u)
    .map((c) => c.replace(/^\s*(?:[-*•]|\d+[.)])\s+/u, "").trim())
    .filter(Boolean);

/** Vị trí (theo từ) của động từ sửa đầu tiên nếu nó nằm trong cửa sổ mở câu; -1 nếu không. */
const leadVerbIndex = (ws: string[]): number => {
  const verbs = new RegExp(`^(?:${EDIT_VERB_SRC})$`, "iu");
  for (let i = 0; i < ws.length && i < VERB_WINDOW + 1; i++) {
    if (verbs.test(ws[i])) return i;
  }
  return -1;
};

/**
 * Tin là CÂU TRẢ LỜI cho câu hỏi / thẻ đang chờ, không phải lệnh: nhiều dòng (hoặc đánh số / gạch đầu dòng), hoặc mở bằng
 * "trả lời", "câu 3", "1." … Tin dạng này không bao giờ chuyển sang Sửa tài liệu — kể cả khi trong đó có chữ "thông báo", "ghi", "đổi".
 */
export const isAnswerShaped = (text: string): boolean => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3) return true;
  if (lines.length >= 2 && lines.filter((l) => /^(?:[-*•]|\d+[.)]|câu\s*\d+)/iu.test(l)).length >= 2) return true;
  if (/^(?:mình\s+|em\s+|tôi\s+)?(?:trả lời|tra loi|đáp|dap)(?!\p{L})/iu.test(text.trim())) return true;
  if (/^(?:câu|cau)\s*\d+/iu.test(text.trim())) return true;
  // Một khối dài ghép nhiều ý ("(1) …; (2) …") cũng là trả lời hàng loạt
  return (text.match(/(?:^|\s)\(?\d+[.)]\s/g) ?? []).length >= 3;
};

/** Số mục được nhắc ("mục 5.3", "§3.1.5"), chỉ mục có trong bảng. */
export const mentionedSections = (text: string): string[] =>
  [...new Set([...text.matchAll(SECTION_MENTION)].map((m) => m[1]).filter((n) => n in SECTION_COLLECTIONS))];

export const gateEditRoute = (text: string, stepId: string | null, callsUsed: number | null | undefined): GateEditRoute | null => {
  if (!text.trim() || !stepId) return null;
  if (callsUsed !== null && callsUsed !== undefined && callsUsed >= CALLS_LIMIT) return "callLimit";
  // Câu trả lời cho câu hỏi / thẻ đang chờ đi `revision` của bước (AI ghi vào Brief) — không bao giờ qua Sửa tài liệu
  if (isAnswerShaped(text)) return null;
  const writes = new Set((getStepDef(stepId)?.writes ?? []).map((w) => w.split(":")[0]));
  for (const clause of clausesOf(text)) {
    const ws = words(clause);
    const at = leadVerbIndex(ws);
    if (at >= 0) {
      // tân ngữ của động từ: tên loại / số mục nằm ngay sau nó
      const object = ws.slice(at + 1, at + 1 + OBJECT_WINDOW).join(" ");
      const targets = [...mentionedSections(object).flatMap((n) => SECTION_COLLECTIONS[n]), ...mentionedKinds(object)];
      if (targets.length > 0 && !targets.some((c) => writes.has(c))) return "otherSection";
    }
    // Lệnh đổi phạm vi bản phát hành ở bước không ghi phạm vi (#20: S-5.5 chỉ ghi màn hình)
    if (SCOPE_NARROWING.some((re) => re.test(clause)) && (at >= 0 || /^(?:bản|ban)\s/iu.test(clause) || ws.length <= 24)) {
      if (!SCOPE_COLLECTIONS.some((c) => writes.has(c))) return "otherSection";
    }
  }
  return null;
};

/**
 * Loại phần tử gọi bằng tên ("toàn bộ thông báo", "quy tắc nghiệp vụ BR-03") — E2E P08: ở cổng S-9.5 "Sửa toàn bộ thông báo…"
 * đi thành revision của bước và AI của bước trả "không thấy thông báo nào".
 */
const KIND_NAMES: readonly [string, RegExp][] = [
  ["messages", /thông báo|(?<!\p{L})messages?(?!\p{L})/iu],
  ["business_rules", /quy tắc nghiệp vụ|business rules?/iu],
  ["nfrs", /phi chức năng|(?<!\p{L})nfrs?(?!\p{L})/iu],
  ["glossary", /thuật ngữ|glossary/iu],
  ["other_requirements", /yêu cầu khác|other requirements?/iu],
  ["common_requirements", /yêu cầu chung|common requirements?/iu],
];

export const mentionedKinds = (text: string): string[] => KIND_NAMES.filter(([, re]) => re.test(text)).map(([kind]) => kind);
