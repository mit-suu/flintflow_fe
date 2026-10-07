import type { ChangeSummary } from "@/types/pipeline";
import { FORM_FACTOR_LABEL, STAKES_LABEL } from "./brief-labels";

/** Quyết định của user về một giả định AI vừa đặt ra — dùng ở panel Cờ / rà giả định, không còn ở cổng chốt. */
export type AssumptionDecision =
  | { kind: "confirm"; id: string }
  | { kind: "reject"; id: string }
  | { kind: "edit"; id: string; statement: string }
  /** Giả định về một trường có tập giá trị cố định (nền tảng, mức độ quan trọng): chọn giá trị, không gõ, không gọi AI. */
  | { kind: "pick"; id: string; path: PickablePath; value: string; label: string };

/**
 * Trường `project` sửa bằng chọn giá trị — nhãn tiếng Việt dùng chung với Brief panel; `titleEn` dựng câu giả định
 * tiếng Anh (bản vào SRS).
 */
export const PICKABLE_FIELDS = {
  "project.form_factor": { title: "Nền tảng", titleEn: "Platform", labels: FORM_FACTOR_LABEL },
  "project.stakes": { title: "Mức độ quan trọng", titleEn: "Stakes", labels: STAKES_LABEL },
} as const;

export type PickablePath = keyof typeof PICKABLE_FIELDS;

export interface BlockingFlag {
  id: string;
  message: string;
  remediation_step?: string;
}

const KIND_PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };
const KIND_VERB: Record<ChangeSummary["kind"], string> = { add: "thêm", update: "sửa", remove: "bỏ" };

const COLLECTION_VI: Record<string, string> = {
  project: "thông tin dự án",
  features: "nhóm chức năng",
  actors: "actor",
  roles: "vai trò",
  use_cases: "use case",
  screens: "màn hình",
  permissions: "quyền",
  entities: "thực thể",
  functions: "chức năng",
  validations: "ràng buộc",
  nfrs: "yêu cầu phi chức năng",
  business_rules: "quy tắc nghiệp vụ",
  common_requirements: "yêu cầu chung",
  messages: "thông điệp",
  other_requirements: "yêu cầu khác",
  glossary: "thuật ngữ",
  addendum: "ghi chú Brief",
  assumptions: "giả định",
  diagrams: "sơ đồ",
};

/** Gom tóm tắt theo (loại thay đổi × collection) để hiện "+3 use case: A, B, C". */
export const groupSummary = (summary: readonly ChangeSummary[]): { key: string; label: string; items: ChangeSummary[] }[] => {
  const groups = new Map<string, ChangeSummary[]>();
  for (const row of summary) {
    const key = `${row.kind}|${row.collection}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const [kind, collection] = key.split("|") as [ChangeSummary["kind"], string];
    return { key, label: `${KIND_PREFIX[kind]}${items.length} ${COLLECTION_VI[collection] ?? collection}`, items };
  });
};

/** Field lẻ của `project`: BE ghi tiêu đề dạng "<field>: <giá trị>" — dịch cả hai sang lời thường. */
const PROJECT_FIELD_VI: Record<string, string> = {
  name: "Tên dự án",
  system_name: "Tên hệ thống",
  vision: "Tầm nhìn",
  goals: "Mục tiêu",
  type: "Loại dự án",
  domain: "Lĩnh vực",
  complexity: "Độ phức tạp",
  form_factor: "Nền tảng",
  stakes: "Mức độ quan trọng",
  release_scope: "Phạm vi phát hành",
  review_mode: "Chế độ duyệt",
};

const PROJECT_VALUE_VI: Record<string, string> = {
  small: "Nhỏ",
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  large: "Lớn",
  web_app: "Web",
  web_application: "Ứng dụng web",
  mobile_app: "Ứng dụng di động",
  desktop_app: "Ứng dụng máy tính",
  api_service: "Dịch vụ API",
  cli: "Dòng lệnh (CLI)",
  embedded: "Hệ thống nhúng",
  internal: "Nội bộ",
  production: "Sản phẩm thật",
  regulated: "Chịu quản lý pháp lý",
  strict: "Mọi bước",
  balanced: "Cuối giai đoạn",
  fast: "Cuối giai đoạn",
};

/** `"complexity: small"` ⇒ `"Độ phức tạp: Nhỏ"`; tiêu đề khác giữ nguyên. */
export const projectFieldText = (title: string): string => {
  const match = /^([a-z_]+):\s*(.*)$/.exec(title.trim());
  if (!match) return title;
  const [, field, value] = match;
  const label = PROJECT_FIELD_VI[field];
  if (!label) return title;
  return `${label}: ${PROJECT_VALUE_VI[value.trim()] ?? value}`;
};

/** Nối các mục tóm tắt: bỏ dấu câu cuối mỗi mục rồi nối bằng "; " — không còn "nhà nước., Từ…". */
export const joinSummaryTexts = (texts: readonly string[]): string =>
  texts
    .map((text) => text.trim().replace(/[\s.,;:]+$/u, ""))
    .filter((text) => text !== "")
    .join("; ");

const FALLBACK_CLOSING = "Bạn xem giúp, ổn thì mình đi tiếp nhé.";
/** Chữ cái riêng của tiếng Việt — lý do "không đổi gì" BE viết sẵn bằng đúng một trong hai ngôn ngữ (FLF-260). */
const VIETNAMESE_LETTER = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
/** Số nhóm / số mục mỗi nhóm nêu tên trong câu tạm — dài hơn thì user đọc tài liệu. */
const FALLBACK_MAX_GROUPS = 4;
const FALLBACK_MAX_ITEMS = 3;

/**
 * Câu thay cho `message_vi` khi BE chưa gửi (dự án cũ): dựng từ tóm tắt thay đổi thành một câu đọc được. Giả định không
 * kể lần hai — chúng đã được xác nhận cùng lúc user bấm đi tiếp.
 */
export const fallbackGateMessage = (summary: readonly ChangeSummary[], noChangeReason?: string): string => {
  const shown = summary.filter((row) => row.collection !== "assumptions");
  if (shown.length === 0) {
    const reason = noChangeReason?.trim().replace(/[\s.]+$/u, "");
    if (!reason) return `Tôi đã xong bước này. ${FALLBACK_CLOSING}`;
    // Lý do đi theo ngôn ngữ AI trả lời trong phiên (FLF-260) — câu bọc theo cùng ngôn ngữ, không ra câu nửa Việt nửa Anh.
    return VIETNAMESE_LETTER.test(reason)
      ? `Bước này không thay đổi tài liệu: ${reason}. ${FALLBACK_CLOSING}`
      : `This step doesn't change the document: ${reason}. Take a look — if it looks right, let's move on.`;
  }
  const groups = new Map<string, ChangeSummary[]>();
  for (const row of shown) {
    const key = `${row.kind}|${row.collection}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const parts = [...groups.entries()].slice(0, FALLBACK_MAX_GROUPS).map(([key, items]) => {
    const [kind, collection] = key.split("|") as [ChangeSummary["kind"], string];
    const titles = joinSummaryTexts(
      items.slice(0, FALLBACK_MAX_ITEMS).map((item) => (item.collection === "project" ? projectFieldText(item.title_vi) : item.title_vi))
    );
    const more = items.length > FALLBACK_MAX_ITEMS ? "; …" : "";
    return `${KIND_VERB[kind]} ${items.length} ${COLLECTION_VI[collection] ?? collection}${titles ? ` (${titles}${more})` : ""}`;
  });
  const rest = groups.size > FALLBACK_MAX_GROUPS ? ", và vài mục khác" : "";
  return `Tôi đã cập nhật: ${parts.join(", ")}${rest}. ${FALLBACK_CLOSING}`;
};
