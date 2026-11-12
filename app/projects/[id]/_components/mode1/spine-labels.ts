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
  // FLF-375: chỗ CR chạm tới trong tài liệu upload — hiện bằng tên, không bằng tên mảng tiếng Anh
  "verifications",
  "references",
  "deployment_nodes",
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
  // FLF-278: mẫu cố định (mẫu bắt buộc / mẫu công ty của dự án có sẵn)
  "template_section_absent",
  "template_section_empty",
  "import_title_content_mismatch",
  "verification_orphan",
  "import_needs_review",
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

/**
 * FLF-411 #23: phần tử trong bản xem trước thay đổi gọi bằng TÊN, không bằng mã nội bộ (`A04`). Chỉ mã in ra tài liệu
 * (use case, quy tắc nghiệp vụ, thông báo, NFR) mới được dùng thay tên khi phần tử không có tên.
 */
const NAME_FIELDS = ["name", "term", "title", "heading"] as const;
const DESCRIPTION_FIELDS = ["description", "statement", "definition", "text"] as const;
const DOC_CODE_COLLECTIONS: ReadonlySet<string> = new Set(["use_cases", "business_rules", "messages", "nfrs"]);
/** Field enum có nhãn (`mode1.spine.values.<nhóm>.<giá trị>`). `type` của actor cũ dùng chung nhãn với `kind`. */
const ENUM_FIELDS: Readonly<Record<string, string>> = { kind: "kind", type: "kind", priority: "priority", category: "category", tier: "tier", status: "status" };

/** Tên mọi phần tử có tên trong Spine, theo bộ sưu tập: `{ actors: { A04: "Patron" } }`. */
export type ElementNames = Readonly<Record<string, Readonly<Record<string, string>>>>;

const nameOf = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  for (const f of NAME_FIELDS) {
    const v = rec[f];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

export const elementNames = (spine: object | null | undefined): ElementNames => {
  if (!spine) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [col, items] of Object.entries(spine as Record<string, unknown>)) {
    if (!Array.isArray(items)) continue;
    const table: Record<string, string> = {};
    for (const item of items) {
      const name = nameOf(item);
      const id = item && typeof item === "object" ? (item as Record<string, unknown>).id : undefined;
      if (typeof id === "string" && name) table[id] = name;
    }
    if (Object.keys(table).length) out[col] = table;
  }
  return out;
};

/** `actors[id=A04].flows_in` ⇒ { collection: "actors", key: "A04", field: "flows_in" }; `project.system_name` ⇒ field. */
const ELEMENT_PATH = /^([a-z_]+)(?:\[(?:[a-z_]+=)?([^\]]*)\])?(?:\.([a-z_]+))?/;
export const parseElementPath = (path: string): { collection: string; key: string | undefined; field: string | undefined; whole: boolean } | null => {
  const m = ELEMENT_PATH.exec(path);
  if (!m) return null;
  return { collection: m[1], key: m[2], field: m[3], whole: m[0] === path && m[3] === undefined };
};

const isAbsent = (v: unknown) => typeof v === "object" && v !== null && "_absent" in (v as Record<string, unknown>);

const lowerFirst = (text: string) => (text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : text);

type ChangeLike = { op: string; path: string; before?: unknown; value?: unknown };

/** Thao tác trên cả phần tử: xoá / thêm / thay nguyên khối. */
const wholeVerb = (c: ChangeLike, key: string | undefined): "add" | "remove" | "replace" =>
  c.op === "remove" || isAbsent(c.value) ? "remove" : c.op === "add" || key === "" || c.before == null || isAbsent(c.before) ? "add" : "replace";

export const spineLabels = (t: Mode1T, localeName: string, sectionNames?: ReadonlyMap<string, string>) => {
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
    return field ? `${out.join(" › ")} - ${fieldLabel(field)}` : out.join(" › ");
  };

  /** Nhãn mục theo ngôn ngữ — dùng chung `lib/constants/fpt-sections` (namespace `common.fptSections`). */
  const sectionLabel = (id: string | null): string => (id ? sectionNames?.get(id) : undefined) || fptSectionLabel(id, locale);
  const sectionLabelIn = (
    id: string | null,
    headingMap?: readonly { block_id: string; heading_text: string; section_id?: string }[]
  ): string => fptSectionLabelIn(id, headingMap, locale);

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
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return t(value ? "spine.boolean.yes" : "spine.boolean.no");
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.length ? value.map((v) => readableValue(v, names)).join(", ") : "-";
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => !k.startsWith("_"));
      return entries.length
        ? entries.map(([k, v]) => `${fieldLabel(k)}: ${readableValue(resolveRefs(k, v, names), names)}`).join("; ")
        : "-";
    }
    return String(value);
  };

  /** Nhãn giá trị enum (`human` ⇒ "Người dùng"); giá trị lạ ⇒ giữ nguyên. */
  const enumLabel = (field: string | undefined, value: unknown): unknown => {
    const group = field ? ENUM_FIELDS[field] : undefined;
    if (!group || typeof value !== "string" || !KEY_SAFE.test(value)) return value;
    const key = `spine.values.${group}.${value}`;
    return t.has(key) ? t(key) : value;
  };

  /** Tên phần tử (từ chính giá trị, rồi bảng tên Spine); không có ⇒ mã nếu là mã in ra tài liệu, còn lại `null`. */
  const elementName = (collection: string, key: string | undefined, values: unknown[], names?: ElementNames): string | null => {
    for (const v of values) {
      const n = nameOf(v);
      if (n) return n;
    }
    const fromSpine = key ? names?.[collection]?.[key] : undefined;
    if (fromSpine) return fromSpine;
    return key && DOC_CODE_COLLECTIONS.has(collection) && !/^\d+$/.test(key) ? key : null;
  };

  /**
   * Giá trị cho bảng xem trước: chỉ phần người đọc được. Phần tử nguyên khối ⇒ "Tên - Mô tả"; field enum ⇒ nhãn; field
   * tham chiếu ⇒ tên phần tử; object khác ⇒ chỉ các field có nhãn (bỏ `id`, khoá thô như `flows_in`).
   */
  const humanValue = (value: unknown, field: string | undefined, names?: RefNames): string => {
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "object" && !Array.isArray(value)) {
      const rec = value as Record<string, unknown>;
      const name = nameOf(rec);
      const desc = DESCRIPTION_FIELDS.map((f) => rec[f]).find((v): v is string => typeof v === "string" && v.trim() !== "");
      if (name || desc) {
        // Phần tử mới: kèm các liên kết (tác nhân, chức năng…) gọi bằng tên — thông tin người duyệt cần, không phải khoá thô
        const links = Object.entries(rec)
          .filter(([k, v]) => k in REF_FIELDS && !(Array.isArray(v) && v.length === 0) && v !== null && v !== "")
          .map(([k, v]) => `${fieldLabel(k)}: ${humanValue(v, k, names)}`);
        return [[name, desc].filter(Boolean).join(" - "), ...links].join("; ");
      }
      const entries = Object.entries(rec).filter(([k, v]) => k !== "id" && !k.startsWith("_") && lookup("fields", k) !== null && v !== null && v !== "");
      return entries.length ? entries.map(([k, v]) => `${fieldLabel(k)}: ${humanValue(v, k, names)}`).join("; ") : "-";
    }
    if (Array.isArray(value)) return value.length ? value.map((v) => humanValue(v, field, names)).join(", ") : "-";
    return readableValue(enumLabel(field, resolveRefs(field, value, names)), names);
  };

  /**
   * Một thay đổi ⇒ câu cho người: "Xoá tác nhân “Patron”", "Đổi tên hệ thống", "Sửa mô tả của use case “View Menu”".
   * Path không đọc được ⇒ nhãn path như cũ.
   */
  const changeLabel = (change: ChangeLike, names?: ElementNames): string => {
    const p = parseElementPath(change.path);
    if (!p || !isEntity(p.collection)) return pathLabel(change.path);
    if (p.collection === "project") {
      if (!p.field) return pathLabel(change.path);
      const field = lookup("change.projectFields", p.field) ?? lowerFirst(fieldLabel(p.field));
      return t("spine.change.setProject", { field });
    }
    const entity = lowerFirst(entityLabel(p.collection));
    if (p.whole || (p.key === "" && !p.field)) {
      const name = elementName(p.collection, p.key || undefined, [change.before, change.value], names);
      const verb = wholeVerb(change, p.key);
      return name ? t(`spine.change.${verb}`, { entity, name }) : t(`spine.change.${verb}Unnamed`, { entity });
    }
    const name = elementName(p.collection, p.key || undefined, [], names);
    const field = lowerFirst(p.field ? fieldLabel(p.field) : t("spine.wholeValue"));
    return name ? t("spine.change.setField", { field, entity, name }) : t("spine.change.setFieldUnnamed", { field, entity });
  };

  /** Phần tử chứa một chỗ tham chiếu (`use_cases[id=UC-06].actor_ids`) ⇒ "Use case “View Menu”". */
  const referrerLabel = (path: string, names?: ElementNames): string => {
    const p = parseElementPath(path);
    if (!p || !isEntity(p.collection) || p.collection === "project") return humanizeText(path);
    const name = elementName(p.collection, p.key || undefined, [], names);
    return name ? `${entityLabel(p.collection)} “${name}”` : entityLabel(p.collection);
  };

  /**
   * FLF-411 #24: câu tóm tắt dựng từ CHÍNH các thay đổi (không từ lời model): "Xoá 6 tác nhân: Patron, …; Đổi tên hệ thống".
   * Gom theo (thao tác, bộ sưu tập); tối đa `maxNames` tên mỗi nhóm.
   */
  const changeSummary = (changes: readonly ChangeLike[], names?: ElementNames, maxNames = 4): string => {
    const groups = new Map<string, { verb: "add" | "remove" | "set"; collection: string; names: string[]; count: number }>();
    const singles: string[] = [];
    for (const c of changes) {
      const p = parseElementPath(c.path);
      if (!p || !isEntity(p.collection) || p.collection === "project" || !(p.whole || (p.key === "" && !p.field))) {
        const label = changeLabel(c, names);
        if (!singles.includes(label)) singles.push(label);
        continue;
      }
      const w = wholeVerb(c, p.key);
      const verb = w === "replace" ? "set" : w;
      const k = `${verb}|${p.collection}`;
      const g = groups.get(k) ?? { verb, collection: p.collection, names: [], count: 0 };
      g.count += 1;
      const n = elementName(p.collection, p.key || undefined, [c.before, c.value], names);
      if (n && !g.names.includes(n)) g.names.push(n);
      groups.set(k, g);
    }
    const parts = [...groups.values()].map((g) => {
      const part = t("spine.change.summaryCount", { verb: t(`spine.change.verbs.${g.verb}`), count: g.count, entity: lowerFirst(entityLabel(g.collection)) });
      if (!g.names.length) return part;
      const shown = g.names.slice(0, maxNames).join(", ");
      const list = g.names.length > maxNames ? t("spine.change.summaryMore", { names: shown, count: g.names.length - maxNames }) : shown;
      return t("spine.change.summaryNames", { part, names: list });
    });
    return [...parts, ...singles].join("; ");
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
    enumLabel,
    humanValue,
    changeLabel,
    referrerLabel,
    changeSummary,
  };
};

export type SpineLabels = ReturnType<typeof spineLabels>;
