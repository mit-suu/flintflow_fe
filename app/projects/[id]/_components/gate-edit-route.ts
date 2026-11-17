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
const EDIT_VERB = /(?<!\p{L})(thêm|them|bổ sung|bo sung|sửa|sua|đổi|doi|xoá|xóa|xoa|bỏ|cập nhật|cap nhat|ghi|add|change|edit|remove|delete|update|rename)(?!\p{L})/iu;

/** Số mục được nhắc ("mục 5.3", "§3.1.5"), chỉ mục có trong bảng. */
export const mentionedSections = (text: string): string[] =>
  [...new Set([...text.matchAll(SECTION_MENTION)].map((m) => m[1]).filter((n) => n in SECTION_COLLECTIONS))];

export const gateEditRoute = (text: string, stepId: string | null, callsUsed: number | null | undefined): GateEditRoute | null => {
  if (!text.trim() || !stepId) return null;
  if (callsUsed !== null && callsUsed !== undefined && callsUsed >= CALLS_LIMIT) return "callLimit";
  if (!EDIT_VERB.test(text)) return null;
  const targets = [...mentionedSections(text).flatMap((n) => SECTION_COLLECTIONS[n]), ...mentionedKinds(text)];
  if (targets.length === 0) return null;
  const writes = new Set((getStepDef(stepId)?.writes ?? []).map((w) => w.split(":")[0]));
  return targets.some((c) => writes.has(c)) ? null : "otherSection";
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
