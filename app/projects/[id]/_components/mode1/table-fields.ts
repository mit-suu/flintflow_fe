/**
 * Field Spine chọn được cho một cột bảng ở 1.7 — nhãn theo ngôn ngữ (`mode1.fields.*`) thay cho `field_path` thô
 * (`glossary[].term`). Giữ đồng bộ với `TABLE_ENTITIES` của BE (`src/modules/import/table-header-dictionary.ts`): BE chỉ
 * trích tất định các field có trong từ điển đó, và chỉ theo **một** thực thể mỗi bảng (thực thể của cột được gán đầu tiên).
 */
import type { TableColumnRole } from "@/types/import";
import type { Mode1T } from "./i18n";
import type { SpineLabels } from "./spine-labels";

export interface TableFieldGroup {
  entity: string;
  fields: readonly string[];
}

export const TABLE_FIELD_GROUPS: readonly TableFieldGroup[] = [
  { entity: "actors", fields: ["id", "name", "kind", "description"] },
  { entity: "use_cases", fields: ["id", "name", "actor_ids", "description", "includes", "extends"] },
  { entity: "screens", fields: ["id", "name", "feature_id", "description"] },
  // Bảng 3.1.4 Non-Screen Functions; bảng yêu cầu "ID | Requirement | Priority" dưới một tính năng (mẫu IEEE — FLF-252)
  { entity: "functions", fields: ["id", "name", "feature_id", "trigger", "description", "priority"] },
  // Ma trận phân quyền: cột đầu là màn hình, mỗi cột sau là một vai trò (BE nhận theo dữ liệu, FLF-252)
  { entity: "permissions", fields: ["screen_id", "role_id"] },
  { entity: "entities", fields: ["name", "description", "relations"] },
  { entity: "business_rules", fields: ["id", "statement"] },
  { entity: "messages", fields: ["code", "text", "function_ids"] },
  { entity: "glossary", fields: ["term", "term_native", "definition"] },
  { entity: "nfrs", fields: ["id", "category", "statement", "metric", "threshold", "priority"] },
  { entity: "common_requirements", fields: ["category", "statement"] },
  { entity: "other_requirements", fields: ["kind", "statement"] },
];

export const tableFieldPath = (entity: string, field: string) => `${entity}[].${field}`;

/** `glossary[].term` ⇒ `glossary`; không đúng dạng ⇒ `null`. */
export const entityOfPath = (path: string | null | undefined): string | null => path?.match(/^([a-z_]+)\[\]\./)?.[1] ?? null;

/** Path có trong danh sách chọn của 1.7 (path lạ do BE thêm sau ⇒ `false`). */
export const isKnownTableField = (path: string): boolean =>
  TABLE_FIELD_GROUPS.some((g) => g.fields.some((f) => tableFieldPath(g.entity, f) === path));

export const tableFields = (t: Mode1T, spine: Pick<SpineLabels, "entityLabel" | "fieldLabel">) => {
  const group = (entity: string | null) => TABLE_FIELD_GROUPS.find((g) => g.entity === entity);

  const tableGroupLabel = (entity: string): string => {
    if (group(entity)) return t(`fields.groups.${entity}`);
    const label = spine.entityLabel(entity);
    return label !== entity ? label : t("fields.other");
  };

  /** Nhãn ngắn của một field trong nhóm ("Mã tác nhân"). */
  const tableItemLabel = (entity: string, field: string): string => t(`fields.items.${entity}.${field}`);

  /**
   * Nhãn đầy đủ "Thuật ngữ — Định nghĩa". Path lạ (BE mới thêm field) ⇒ ghép nhãn chung của thực thể + field, không in
   * path thô `glossary[].term` cho người dùng (FLF-251).
   */
  const tableFieldLabel = (path: string): string => {
    const entity = entityOfPath(path);
    const g = group(entity);
    const field = g?.fields.find((f) => tableFieldPath(g.entity, f) === path);
    if (g && field) return `${tableGroupLabel(g.entity)} — ${tableItemLabel(g.entity, field)}`;
    const rawField = path.split("].")[1] ?? path;
    return `${entity ? tableGroupLabel(entity) : t("fields.other")} — ${spine.fieldLabel(rawField)}`;
  };

  /** Vai trò cột theo dữ liệu (FLF-252) ⇒ nhãn ngắn cho người dùng; vai trò lạ ⇒ rỗng. */
  const columnRoleLabel = (role: TableColumnRole): string => (t.has(`fields.columnRoles.${role}`) ? t(`fields.columnRoles.${role}`) : "");

  return { tableGroupLabel, tableItemLabel, tableFieldLabel, columnRoleLabel };
};
