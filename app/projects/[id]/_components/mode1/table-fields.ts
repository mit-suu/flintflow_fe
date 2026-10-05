/**
 * Field Spine chọn được cho một cột bảng ở 1.7 — nhãn tiếng Việt thay cho `field_path` thô (`glossary[].term`).
 * Giữ đồng bộ với `TABLE_ENTITIES` của BE (`src/modules/import/table-header-dictionary.ts`): BE chỉ trích tất định
 * các field có trong từ điển đó, và chỉ theo **một** thực thể mỗi bảng (thực thể của cột được gán đầu tiên).
 */
import type { TableColumnRole } from "@/types/import";
import { ENTITY_LABELS, fieldLabel } from "./spine-labels";

export interface TableFieldGroup {
  entity: string;
  label: string;
  fields: readonly { field: string; label: string }[];
}

export const TABLE_FIELD_GROUPS: readonly TableFieldGroup[] = [
  {
    entity: "actors",
    label: "Tác nhân",
    fields: [
      { field: "id", label: "Mã tác nhân" },
      { field: "name", label: "Tên tác nhân" },
      { field: "kind", label: "Loại tác nhân" },
      { field: "description", label: "Mô tả" },
    ],
  },
  {
    entity: "use_cases",
    label: "Use case",
    fields: [
      { field: "id", label: "Mã use case" },
      { field: "name", label: "Tên use case" },
      { field: "actor_ids", label: "Tác nhân tham gia" },
      { field: "description", label: "Mô tả" },
      { field: "includes", label: "Use case được include" },
      { field: "extends", label: "Use case được extend" },
    ],
  },
  {
    entity: "screens",
    label: "Màn hình",
    fields: [
      { field: "id", label: "Mã màn hình" },
      { field: "name", label: "Tên màn hình" },
      { field: "feature_id", label: "Thuộc tính năng" },
      { field: "description", label: "Mô tả" },
    ],
  },
  {
    entity: "functions",
    label: "Chức năng không có màn hình",
    fields: [
      { field: "id", label: "Mã chức năng" },
      { field: "name", label: "Tên chức năng" },
      { field: "feature_id", label: "Thuộc tính năng" },
      { field: "trigger", label: "Điều kiện kích hoạt" },
      { field: "description", label: "Mô tả" },
    ],
  },
  {
    // Ma trận phân quyền: cột đầu là màn hình, mỗi cột sau là một vai trò (BE nhận theo dữ liệu, FLF-252)
    entity: "permissions",
    label: "Phân quyền",
    fields: [
      { field: "screen_id", label: "Màn hình" },
      { field: "role_id", label: "Vai trò (mỗi cột một vai trò)" },
    ],
  },
  {
    entity: "entities",
    label: "Thực thể dữ liệu",
    fields: [
      { field: "name", label: "Tên thực thể" },
      { field: "description", label: "Mô tả" },
      { field: "relations", label: "Quan hệ với thực thể khác" },
    ],
  },
  {
    entity: "business_rules",
    label: "Quy tắc nghiệp vụ",
    fields: [
      { field: "id", label: "Mã quy tắc" },
      { field: "statement", label: "Nội dung quy tắc" },
    ],
  },
  {
    entity: "messages",
    label: "Thông báo hệ thống",
    fields: [
      { field: "code", label: "Mã thông báo" },
      { field: "text", label: "Nội dung thông báo" },
      { field: "function_ids", label: "Dùng ở chức năng" },
    ],
  },
  {
    entity: "glossary",
    label: "Thuật ngữ",
    fields: [
      { field: "term", label: "Thuật ngữ / từ viết tắt" },
      { field: "term_native", label: "Thuật ngữ tiếng Việt" },
      { field: "definition", label: "Định nghĩa" },
    ],
  },
  {
    entity: "nfrs",
    label: "Yêu cầu phi chức năng",
    fields: [
      { field: "id", label: "Mã yêu cầu" },
      { field: "category", label: "Nhóm" },
      { field: "statement", label: "Nội dung yêu cầu" },
      { field: "metric", label: "Chỉ số đo" },
      { field: "threshold", label: "Ngưỡng / mục tiêu" },
      { field: "priority", label: "Mức ưu tiên" },
    ],
  },
  {
    entity: "common_requirements",
    label: "Yêu cầu chung",
    fields: [
      { field: "category", label: "Nhóm" },
      { field: "statement", label: "Nội dung yêu cầu" },
    ],
  },
  {
    entity: "other_requirements",
    label: "Yêu cầu khác",
    fields: [
      { field: "kind", label: "Loại" },
      { field: "statement", label: "Nội dung yêu cầu" },
    ],
  },
];

export const tableFieldPath = (entity: string, field: string) => `${entity}[].${field}`;

/** `glossary[].term` ⇒ `glossary`; không đúng dạng ⇒ `null`. */
export const entityOfPath = (path: string | null | undefined): string | null => path?.match(/^([a-z_]+)\[\]\./)?.[1] ?? null;

export const tableGroupLabel = (entity: string): string =>
  TABLE_FIELD_GROUPS.find((g) => g.entity === entity)?.label ?? ENTITY_LABELS[entity] ?? "Dữ liệu khác";

/** Vai trò cột theo dữ liệu (FLF-252) ⇒ nhãn ngắn cho người dùng. */
export const COLUMN_ROLE_LABELS: Readonly<Record<TableColumnRole, string>> = {
  row_no: "số thứ tự",
  code: "mã",
  date: "ngày",
  version: "phiên bản",
  change_type: "loại thay đổi",
  mark: "ô đánh dấu",
  text: "đoạn mô tả",
  name: "tên",
};

/** Path có trong danh sách chọn của 1.7 (path lạ do BE thêm sau ⇒ `false`). */
export const isKnownTableField = (path: string): boolean =>
  TABLE_FIELD_GROUPS.some((g) => g.fields.some((f) => tableFieldPath(g.entity, f.field) === path));

/**
 * Nhãn đầy đủ "Thuật ngữ — Định nghĩa". Path lạ (BE mới thêm field) ⇒ ghép nhãn chung của thực thể + field, không in
 * path thô `glossary[].term` cho người dùng (FLF-251).
 */
export const tableFieldLabel = (path: string): string => {
  const entity = entityOfPath(path);
  const group = TABLE_FIELD_GROUPS.find((g) => g.entity === entity);
  const field = group?.fields.find((f) => tableFieldPath(group.entity, f.field) === path);
  if (group && field) return `${group.label} — ${field.label}`;
  const rawField = path.split("].")[1] ?? path;
  return `${entity ? tableGroupLabel(entity) : "Dữ liệu khác"} — ${fieldLabel(rawField)}`;
};
