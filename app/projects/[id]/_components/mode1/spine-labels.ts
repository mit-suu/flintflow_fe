/**
 * Nhãn cho người dùng thay cho mã kỹ thuật ở mode 1: path Spine (`use_cases[id=UC-01].description`),
 * mã luật cờ (`section_empty`), mã luật kiểm CR (`op_outside_section`), mã mục (`fixed:5.5`). Mã gốc chỉ để tra
 * (tooltip `title`). Path / field lạ (BE thêm sau) ⇒ trả nguyên mã, không mất thông tin.
 *
 * Chữ nằm ở messages `mode1.spine.*`; `spineLabels(t)` trả các hàm đã gắn translator (lấy qua `useMode1Labels()`).
 */
import { FPT_SECTIONS, sectionLabel as fptSectionLabel, sectionLabelIn as fptSectionLabelIn } from "@/lib/constants/fpt-sections";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { Mode1T } from "./i18n";

/** Collection Spine có nhãn (`mode1.spine.entities.<collection>`). */
export const ENTITY_KEYS = [
  "project",
  "features",
  "actors",
  "roles",
  "use_cases",
  "screens",
  "permissions",
  "entities",
  "functions",
  "validations",
  "nfrs",
  "business_rules",
  "common_requirements",
  "messages",
  "other_requirements",
  "glossary",
  "addendum",
  "custom_sections",
  "diagrams",
  "assumptions",
] as const;

const isEntity = (name: string): boolean => (ENTITY_KEYS as readonly string[]).includes(name);

/** Mã luật có nhãn (`mode1.spine.rules.<mã>`): cờ tài liệu, luật kiểm đề xuất CR (3.7), luật engine thay đổi. */
export const RULE_KEYS = [
  "section_empty",
  "array_empty",
  "dead_reference",
  "render_error",
  "diagram_stale",
  "nfr_missing_number",
  "usecase_relation_invalid",
  "unconfirmed_assumption",
  "section_stale_at_baseline",
  "section_awaiting_reaccept",
  "screen_pending_at_baseline",
  "orphan_screen_at_baseline",
  "orphan_screen",
  "orphan_actor",
  "usecase_no_function",
  "screen_no_function",
  "empty_feature",
  "role_no_actor",
  "non_english_content",
  "usecase_floating",
  "usecase_auth_relation",
  "usecase_name_semantic",
  "usecase_name_style",
  "actor_name_shape",
  "system_name_missing",
  "screen_placeholder",
  "derived_from_changed_assumption",
  "function_without_uc",
  "import_semantic",
  "import_image_unread",
  "import_unresolved_ref",
  "original_diagram_stale",
  "accepted_as_is",
  "goal_not_covered",
  "cr_consistency",
  "unconcluded",
  "element_missing",
  "path_not_locked",
  "no_proposal",
  "edit_without_ops",
  "edit_no_change",
  "op_path_not_locked",
  "op_outside_section",
  "comment_empty",
  "op_invalid",
  "new_red_flag",
  "op_schema",
  "op_value_missing",
  "path_invalid",
  "path_not_writable",
  "path_not_resolved",
  "key_change_forbidden",
  "index_selector_forbidden",
  "revert_conflict",
  "schema_invalid",
  "duplicate_section_number",
  "diagram_png_missing",
  "op_not_allowed",
  "op_out_of_scope",
  "conflict",
] as const;

/** Luật mà câu BE chỉ là mã + tên field ⇒ nói bằng lời (`mode1.spine.violations.<mã>`). */
const VIOLATION_KEYS: readonly string[] = ["schema_invalid", "op_schema", "path_not_resolved", "path_not_writable", "duplicate_id"];

/** Mã / tên field dạng máy — mới đem tra messages (key có dấu chấm / khoảng trắng sẽ bị hiểu sai là đường dẫn). */
const KEY_SAFE = /^[A-Za-z0-9_]+$/;

const SEGMENT = /\.?([a-z_]+)(?:\[([^\]]*)\])?/gy;

const PATH_IN_TEXT = new RegExp(
  `\\b(?:project\\.[a-z_]+|(?:${ENTITY_KEYS.join("|")})\\[[^\\]\\s]*\\](?:\\.[a-z_]+(?:\\[[^\\]\\s]*\\])?)*)`,
  "g"
);
const TAG_IN_TEXT = /(^|\s)\[[a-z_]+\]\s*/g;
const SECTION_IN_TEXT = /\b(?:(?:fixed|group):[0-9IVX]+(?:\.[0-9]+)*|(?:custom|feature|function):@?[A-Za-z0-9_-]+)/g;
// Chỉ mã có "_" — tránh đụng từ tiếng Anh thường (vd "conflict")
// `\\b` (không phải `\b`): trong template literal `\b` là ký tự backspace ⇒ regex không bao giờ khớp
const RULE_IN_TEXT = new RegExp(`\\b(?:${RULE_KEYS.filter((k) => k.includes("_")).join("|")})\\b`, "g");

/** Mã có dạng máy (không phải tiêu đề người đặt): `custom:CS07`, `fixed:5.5`, `feature:@B0007`. */
const looksLikeCode = (text: string) => /^[a-z_]+:\S+$/.test(text.trim());

type NamedCollection = "actors" | "roles" | "features" | "screens" | "functions" | "use_cases";

/** Tên phần tử theo mã, từng bộ sưu tập: `{ actors: { A01: "Lecturer" } }`. */
export type RefNames = Partial<Record<NamedCollection, Readonly<Record<string, string>>>>;

/** Field tham chiếu ⇒ bộ sưu tập chứa phần tử được trỏ tới. */
const REF_FIELDS: Readonly<Record<string, NamedCollection>> = {
  actor_id: "actors",
  actor_ids: "actors",
  role_id: "roles",
  feature_id: "features",
  screen_id: "screens",
  flow_to: "screens",
  function_ids: "functions",
  primary_function_id: "functions",
  includes: "use_cases",
  extends: "use_cases",
};

/** Bảng tên từ Spine — để giá trị tham chiếu hiện "Lecturer" thay vì "A01" (FLF-297). */
export const refNames = (spine: Partial<Record<NamedCollection, { id: string; name: string }[]>> | null | undefined): RefNames => {
  if (!spine) return {};
  const out: RefNames = {};
  for (const col of Object.values(REF_FIELDS)) {
    out[col] ??= Object.fromEntries((spine[col] ?? []).filter((e) => e.name).map((e) => [e.id, e.name]));
  }
  return out;
};

/** Mã trong field tham chiếu ⇒ tên; không tìm thấy (phần tử mới thêm cùng lô) ⇒ giữ mã. */
export const resolveRefs = (field: string | undefined, value: unknown, names: RefNames | undefined): unknown => {
  const table = field && names ? names[REF_FIELDS[field]] : undefined;
  if (!table) return value;
  const name = (id: unknown) => (typeof id === "string" && table[id]) || id;
  return Array.isArray(value) ? value.map(name) : name(value);
};

export const spineLabels = (t: Mode1T, localeName: string) => {
  const locale = isLocale(localeName) ? localeName : DEFAULT_LOCALE;
  /** Tra key, không có ⇒ `null` (mã lạ). */
  const lookup = (group: string, code: string): string | null => {
    if (!KEY_SAFE.test(code)) return null;
    const key = `spine.${group}.${code}`;
    return t.has(key) ? t(key) : null;
  };

  const fieldLabel = (field: string): string => lookup("fields", field) ?? field;

  /** `use_cases` ⇒ "Use case"; collection lạ ⇒ giữ mã. */
  const entityLabel = (entity: string): string => (isEntity(entity) ? t(`spine.entities.${entity}`) : entity);

  /**
   * `use_cases[id=UC-2.4].description` ⇒ "Use case UC-2.4 — Mô tả"; `actors[]` ⇒ "Tác nhân (thêm mới)";
   * `project.code` ⇒ "Thông tin dự án — Mã". Không đọc được ⇒ trả nguyên path. Có `entityName` (BE `ReviewField.entity_name`)
   * ⇒ ghép sau mã phần tử: "Tác nhân A01 (Learner) — Loại".
   */
  const pathLabel = (path: string, entityName?: string): string => {
    const parts: { name: string; selector: string | undefined }[] = [];
    SEGMENT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while (SEGMENT.lastIndex < path.length && (m = SEGMENT.exec(path))) parts.push({ name: m[1], selector: m[2] });
    if (!parts.length || SEGMENT.lastIndex !== path.length || !isEntity(parts[0].name)) return path;
    SEGMENT.lastIndex = 0;

    const out: string[] = [];
    let field: string | null = null;
    for (const p of parts) {
      if (p.selector === undefined && p.name !== "project") {
        field = p.name;
        continue;
      }
      const label = isEntity(p.name) ? entityLabel(p.name) : fieldLabel(p.name);
      if (p.selector === undefined) out.push(label);
      else if (p.selector === "") out.push(t("spine.path.added", { label }));
      else {
        const key = p.selector.includes("=") ? p.selector.slice(p.selector.indexOf("=") + 1) : p.selector;
        out.push(/^\d+$/.test(key) ? `${label} #${Number(key) + 1}` : `${label} ${key}`);
      }
      field = null;
    }
    if (entityName && parts[0].selector) out[0] += ` (${entityName})`;
    return field ? `${out.join(" › ")} — ${fieldLabel(field)}` : out.join(" › ");
  };

  /** Nhãn mục theo ngôn ngữ — dùng chung `lib/constants/fpt-sections` (namespace `common.fptSections`). */
  const sectionLabel = (id: string | null): string => fptSectionLabel(id, locale);
  const sectionLabelIn = (id: string | null, headingMap?: readonly { block_id: string; heading_text: string }[]): string =>
    fptSectionLabelIn(id, headingMap, locale);

  /** Mục trong câu chữ: `fixed:5.1` ⇒ "5.1 Business Rules". */
  const sectionName = (sectionId: string | null | undefined): string => (sectionId ? sectionLabel(sectionId) : "");

  /** Mã lạ (BE thêm sau, luật do AI đặt tên tự do) ⇒ chuỗi rỗng: câu thông báo đã đủ nghĩa, mã gốc để ở tooltip. */
  const ruleLabel = (ruleId: string): string => ((RULE_KEYS as readonly string[]).includes(ruleId) ? t(`spine.rules.${ruleId}`) : "");

  /**
   * Câu thông báo của BE / AI ⇒ chữ thường: bỏ tiền tố `[ambiguity]`, path Spine ⇒ tên phần tử,
   * mã mục `fixed:5.5` ⇒ "5.5 Glossary", mã luật `section_empty` ⇒ "Mục còn trống". Câu của BE giữ nguyên văn.
   */
  const humanizeText = (text: string): string =>
    text
      .replace(TAG_IN_TEXT, "$1")
      .replace(PATH_IN_TEXT, (p) => pathLabel(p))
      .replace(SECTION_IN_TEXT, (id) => sectionLabel(id))
      .replace(RULE_IN_TEXT, (id) => ruleLabel(id));

  /**
   * Tên mục để hiển thị: ưu tiên tiêu đề BE gửi (heading của chính tài liệu) khi đó là chữ thường; tiêu đề rỗng / là mã
   * / chỉ là tên mẫu FPT không số ⇒ nhãn từ mã mục ("5.5 Glossary", "Mục riêng", "Tính năng F2").
   */
  const sectionTitle = (sectionId: string | null | undefined, title?: string | null): string => {
    const fpt = FPT_SECTIONS.find((s) => s.id === sectionId);
    if (fpt && (!title || title === fpt.title)) return sectionName(sectionId);
    if (title && title.trim() && title !== sectionId && !looksLikeCode(title)) return humanizeText(title);
    return sectionName(sectionId) || (title ? humanizeText(title) : "");
  };

  /** Giá trị Spine ⇒ chữ đọc được (không JSON): mảng nối ", ", object "Tên: …; Mô tả: …", rỗng "—". */
  const readableValue = (value: unknown, names?: RefNames): string => {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return t(value ? "spine.boolean.yes" : "spine.boolean.no");
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.length ? value.map((v) => readableValue(v, names)).join(", ") : "—";
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => !k.startsWith("_"));
      return entries.length
        ? entries.map(([k, v]) => `${fieldLabel(k)}: ${readableValue(resolveRefs(k, v, names), names)}`).join("; ")
        : "—";
    }
    return String(value);
  };

  /**
   * Lỗi của một lô sửa ⇒ câu cho người. Có luật mà câu BE chỉ là mã + tên field (`schema_invalid`: `Sai schema tại
   * "screens.0": Unrecognized key: "authorized_role_ids"`) — nói bằng lời; luật còn lại chỉ humanize path/mã mục.
   * Câu gốc để ở `title` cho ai cần soi.
   */
  const violationText = (violation: { rule: string; message: string }): string =>
    VIOLATION_KEYS.includes(violation.rule) ? t(`spine.violations.${violation.rule}`) : humanizeText(violation.message);

  /** Tham chiếu nguồn của CR (`fixed:5.5`, `chat:66f1…`, id diff) ⇒ chữ; mã nội bộ không đọc được thì ẩn. */
  const sourceRefLabel = (ref: string | null | undefined): string => {
    if (!ref) return "";
    if (/^chat:/.test(ref)) return t("spine.fromChat");
    if (/^flag:/.test(ref)) return "";
    if (/^[0-9a-f]{24}$|^[0-9a-f-]{36}$/i.test(ref)) return "";
    return humanizeText(ref);
  };

  return {
    fieldLabel,
    entityLabel,
    pathLabel,
    sectionLabel,
    sectionLabelIn,
    sectionName,
    sectionTitle,
    ruleLabel,
    humanizeText,
    readableValue,
    violationText,
    sourceRefLabel,
  };
};

export type SpineLabels = ReturnType<typeof spineLabels>;
