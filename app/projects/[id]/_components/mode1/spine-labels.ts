/**
 * Nhãn cho người dùng thay cho mã kỹ thuật ở mode 1: path Spine (`use_cases[id=UC-01].description`),
 * mã luật cờ (`section_empty`), mã luật kiểm CR (`op_outside_section`). Mã gốc chỉ để tra (tooltip `title`).
 * Path / field lạ (BE thêm sau) ⇒ trả nguyên mã, không mất thông tin.
 */
import { FPT_SECTIONS, sectionLabel } from "@/lib/constants/fpt-sections";

export const ENTITY_LABELS: Readonly<Record<string, string>> = {
  project: "Thông tin dự án",
  features: "Tính năng",
  actors: "Tác nhân",
  roles: "Vai trò",
  use_cases: "Use case",
  screens: "Màn hình",
  permissions: "Phân quyền",
  entities: "Thực thể dữ liệu",
  functions: "Chức năng",
  validations: "Kiểm tra dữ liệu",
  nfrs: "Yêu cầu phi chức năng",
  business_rules: "Quy tắc nghiệp vụ",
  common_requirements: "Yêu cầu chung",
  messages: "Thông báo hệ thống",
  other_requirements: "Yêu cầu khác",
  glossary: "Thuật ngữ",
  addendum: "Ghi chú bổ sung",
  custom_sections: "Mục riêng",
  diagrams: "Sơ đồ",
  assumptions: "Giả định",
};

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  id: "Mã",
  name: "Tên",
  description: "Mô tả",
  kind: "Loại",
  type: "Loại",
  aliases: "Tên khác",
  actor_id: "Tác nhân",
  actor_ids: "Tác nhân",
  function_ids: "Chức năng liên quan",
  includes: "Include",
  extends: "Extend",
  feature_id: "Tính năng",
  screen_id: "Màn hình",
  role_id: "Vai trò",
  action: "Thao tác",
  flow_to: "Chuyển tới màn",
  is_popup: "Là popup",
  tabs: "Tab",
  primary_function_id: "Chức năng chính",
  relations: "Quan hệ",
  order: "Thứ tự",
  trigger: "Điều kiện kích hoạt",
  normal: "Luồng chính",
  abnormal: "Luồng ngoại lệ",
  validations: "Kiểm tra dữ liệu",
  business_rule_ids: "Quy tắc nghiệp vụ",
  source_validation_ids: "Kiểm tra nguồn",
  priority: "Độ ưu tiên",
  statement: "Nội dung",
  category: "Nhóm",
  metric: "Chỉ số đo",
  threshold: "Ngưỡng",
  threshold_ms: "Ngưỡng (ms)",
  tier: "Mức",
  code: "Mã",
  text: "Nội dung",
  term: "Thuật ngữ",
  term_native: "Thuật ngữ (tiếng Việt)",
  definition: "Định nghĩa",
  heading: "Tiêu đề",
  blocks: "Nội dung",
  content: "Nội dung",
  topic: "Chủ đề",
  rationale: "Lý do",
  status: "Trạng thái",
  system_name: "Tên hệ thống",
  vision: "Tầm nhìn",
  goals: "Mục tiêu",
  domain: "Lĩnh vực",
  release_scope: "Phạm vi phát hành",
};

export const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

const SEGMENT = /\.?([a-z_]+)(?:\[([^\]]*)\])?/gy;

/**
 * `use_cases[id=UC-2.4].description` ⇒ "Use case UC-2.4 — Mô tả"; `actors[]` ⇒ "Tác nhân (thêm mới)";
 * `project.code` ⇒ "Thông tin dự án — Mã". Không đọc được ⇒ trả nguyên path.
 */
export const pathLabel = (path: string): string => {
  const parts: { name: string; selector: string | undefined }[] = [];
  SEGMENT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (SEGMENT.lastIndex < path.length && (m = SEGMENT.exec(path))) parts.push({ name: m[1], selector: m[2] });
  if (!parts.length || SEGMENT.lastIndex !== path.length || !(parts[0].name in ENTITY_LABELS)) return path;
  SEGMENT.lastIndex = 0;

  const out: string[] = [];
  let field: string | null = null;
  for (const p of parts) {
    if (p.selector === undefined && p.name !== "project") {
      field = p.name;
      continue;
    }
    const label = ENTITY_LABELS[p.name] ?? fieldLabel(p.name);
    if (p.selector === undefined) out.push(label);
    else if (p.selector === "") out.push(`${label} (thêm mới)`);
    else {
      const key = p.selector.includes("=") ? p.selector.slice(p.selector.indexOf("=") + 1) : p.selector;
      out.push(/^\d+$/.test(key) ? `${label} #${Number(key) + 1}` : `${label} ${key}`);
    }
    field = null;
  }
  return field ? `${out.join(" › ")} — ${fieldLabel(field)}` : out.join(" › ");
};

const PATH_IN_TEXT = new RegExp(
  `\\b(?:project\\.[a-z_]+|(?:${Object.keys(ENTITY_LABELS).join("|")})\\[[^\\]\\s]*\\](?:\\.[a-z_]+(?:\\[[^\\]\\s]*\\])?)*)`,
  "g"
);

/** Mục trong câu chữ: `fixed:5.1` ⇒ "5.1 Business Rules". */
export const sectionName = (sectionId: string | null | undefined): string => (sectionId ? sectionLabel(sectionId) : "");

/** Mã có dạng máy (không phải tiêu đề người đặt): `custom:CS07`, `fixed:5.5`, `feature:@B0007`. */
const looksLikeCode = (text: string) => /^[a-z_]+:\S+$/.test(text.trim());

/**
 * Tên mục để hiển thị: ưu tiên tiêu đề BE gửi (heading của chính tài liệu) khi đó là chữ thường; tiêu đề rỗng / là mã
 * / chỉ là tên mẫu FPT không số ⇒ nhãn từ mã mục ("5.5 Glossary", "Mục riêng", "Tính năng F2").
 */
export const sectionTitle = (sectionId: string | null | undefined, title?: string | null): string => {
  const fpt = FPT_SECTIONS.find((s) => s.id === sectionId);
  if (fpt && (!title || title === fpt.title)) return sectionName(sectionId);
  if (title && title.trim() && title !== sectionId && !looksLikeCode(title)) return humanizeText(title);
  return sectionName(sectionId) || (title ? humanizeText(title) : "");
};

const BOOLEAN_TEXT = { true: "Có", false: "Không" } as const;

/** Giá trị Spine ⇒ chữ đọc được (không JSON): mảng nối ", ", object "Tên: …; Mô tả: …", rỗng "—". */
export const readableValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return BOOLEAN_TEXT[String(value) as "true" | "false"];
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(readableValue).join(", ") : "—";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => !k.startsWith("_"));
    return entries.length ? entries.map(([k, v]) => `${fieldLabel(k)}: ${readableValue(v)}`).join("; ") : "—";
  }
  return String(value);
};

export const RULE_LABELS: Readonly<Record<string, string>> = {
  // cờ của tài liệu (deterministic-check + cờ do AI đặt)
  section_empty: "Mục còn trống",
  array_empty: "Danh sách còn trống",
  dead_reference: "Tham chiếu tới phần không tồn tại",
  render_error: "Lỗi vẽ sơ đồ",
  diagram_stale: "Sơ đồ chưa cập nhật",
  nfr_missing_number: "Yêu cầu phi chức năng thiếu số đo",
  usecase_relation_invalid: "Quan hệ include/extend không hợp lệ",
  unconfirmed_assumption: "Giả định chưa xác nhận",
  section_stale_at_baseline: "Mục cần xem lại",
  section_awaiting_reaccept: "Mục chờ chấp nhận lại",
  screen_pending_at_baseline: "Màn hình chưa mô tả xong",
  orphan_screen_at_baseline: "Màn hình không nằm trong luồng nào",
  orphan_screen: "Màn hình không nằm trong luồng nào",
  orphan_actor: "Tác nhân chưa gắn use case",
  usecase_no_function: "Use case chưa gắn chức năng",
  screen_no_function: "Màn hình chưa có chức năng",
  empty_feature: "Tính năng chưa có màn hình hay chức năng",
  role_no_actor: "Vai trò chưa gắn tác nhân",
  non_english_content: "Nội dung chưa phải tiếng Anh",
  usecase_floating: "Use case không gắn tác nhân",
  usecase_auth_relation: "Use case đăng nhập đặt sai quan hệ",
  usecase_name_semantic: "Tên use case chưa rõ nghĩa",
  usecase_name_style: "Tên use case chưa đúng dạng",
  actor_name_shape: "Tên tác nhân chưa đúng dạng",
  system_name_missing: "Thiếu tên hệ thống",
  screen_placeholder: "Màn hình còn để trống",
  derived_from_changed_assumption: "Dựa trên giả định đã đổi",
  function_without_uc: "Chức năng chưa thuộc use case nào",
  import_semantic: "AI phát hiện vấn đề nội dung",
  import_image_unread: "Ảnh chưa đọc được",
  accepted_as_is: "Chấp nhận nguyên trạng",
  goal_not_covered: "Mục tiêu chưa được đáp ứng",
  cr_consistency: "Chưa nhất quán sau khi sửa",
  // luật kiểm đề xuất CR (3.7)
  unconcluded: "Chưa có kết luận",
  element_missing: "Phần tử không còn trong tài liệu",
  path_not_locked: "Chưa được khoá cho CR này",
  no_proposal: "Thiếu đề xuất",
  edit_without_ops: "Kết luận sửa nhưng chưa có nội dung sửa",
  edit_no_change: "Đề xuất không thay đổi gì",
  op_path_not_locked: "Sửa vào phần CR không giữ",
  op_outside_section: "Sửa ngoài phạm vi của vị trí",
  comment_empty: "Comment còn trống",
  op_invalid: "Nội dung sửa sai định dạng",
  new_red_flag: "Làm phát sinh lỗi đỏ mới",
  // luật kiểm bản xem trước / engine thay đổi (lệnh sửa không áp được)
  op_schema: "Nội dung sửa sai cấu trúc",
  op_value_missing: "Thiếu giá trị mới",
  path_invalid: "Vị trí sửa không hợp lệ",
  path_not_writable: "Phần này không sửa trực tiếp được",
  path_not_resolved: "Không tìm thấy phần cần sửa",
  key_change_forbidden: "Không được đổi mã định danh",
  index_selector_forbidden: "Phải chỉ rõ phần tử bằng mã",
  revert_conflict: "Không hoàn tác được vì đã có thay đổi sau đó",
  schema_invalid: "Dữ liệu không đúng cấu trúc",
  duplicate_section_number: "Trùng số mục",
  diagram_png_missing: "Sơ đồ chưa có ảnh",
  op_not_allowed: "Thao tác không được phép",
  op_out_of_scope: "Sửa ngoài phạm vi cho phép",
  conflict: "Xung đột với thay đổi khác",
};

/** Mã lạ (BE thêm sau, luật do AI đặt tên tự do) ⇒ chuỗi rỗng: câu thông báo đã đủ nghĩa, mã gốc để ở tooltip. */
export const ruleLabel = (ruleId: string): string => RULE_LABELS[ruleId] ?? "";


const TAG_IN_TEXT = /(^|\s)\[[a-z_]+\]\s*/g;
const SECTION_IN_TEXT = /\b(?:(?:fixed|group):[0-9IVX]+(?:\.[0-9]+)*|(?:custom|feature|function):@?[A-Za-z0-9_-]+)/g;
// Chỉ mã có "_" — tránh đụng từ tiếng Anh thường (vd "conflict")
const RULE_IN_TEXT = new RegExp(`\b(?:${Object.keys(RULE_LABELS).filter((k) => k.includes("_")).join("|")})\b`, "g");

/**
 * Câu thông báo của BE / AI ⇒ chữ thường: bỏ tiền tố `[ambiguity]`, path Spine ⇒ tên phần tử,
 * mã mục `fixed:5.5` ⇒ "5.5 Glossary", mã luật `section_empty` ⇒ "Mục còn trống".
 */
export const humanizeText = (text: string): string =>
  text
    .replace(TAG_IN_TEXT, "$1")
    .replace(PATH_IN_TEXT, (p) => pathLabel(p))
    .replace(SECTION_IN_TEXT, (id) => sectionLabel(id))
    .replace(RULE_IN_TEXT, (id) => RULE_LABELS[id]);

/** Tham chiếu nguồn của CR (`fixed:5.5`, `chat:66f1…`, id diff) ⇒ chữ; mã nội bộ không đọc được thì ẩn. */
export const sourceRefLabel = (ref: string | null | undefined): string => {
  if (!ref) return "";
  if (/^chat:/.test(ref)) return "từ khung chat";
  if (/^flag:/.test(ref)) return "";
  if (/^[0-9a-f]{24}$|^[0-9a-f-]{36}$/i.test(ref)) return "";
  return humanizeText(ref);
};
