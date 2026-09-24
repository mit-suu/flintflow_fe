/**
 * Field Spine chọn được cho một cột bảng ở 1.7 — nhãn tiếng Việt thay cho `field_path` thô (`glossary[].term`).
 * Giữ đồng bộ với `TABLE_ENTITIES` của BE (`src/modules/import/table-header-dictionary.ts`): BE chỉ trích tất định
 * các field có trong từ điển đó, và chỉ theo **một** thực thể mỗi bảng (thực thể của cột được gán đầu tiên).
 */
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
    ],
  },
  {
    entity: "screens",
    label: "Màn hình",
    fields: [
      { field: "id", label: "Mã màn hình" },
      { field: "name", label: "Tên màn hình" },
      { field: "description", label: "Mô tả" },
    ],
  },
  {
    entity: "entities",
    label: "Thực thể dữ liệu",
    fields: [
      { field: "name", label: "Tên thực thể" },
      { field: "description", label: "Mô tả" },
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
    ],
  },
  {
    entity: "glossary",
    label: "Thuật ngữ",
    fields: [
      { field: "term", label: "Thuật ngữ / từ viết tắt" },
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

export const tableGroupLabel = (entity: string): string => TABLE_FIELD_GROUPS.find((g) => g.entity === entity)?.label ?? entity;

/** Nhãn đầy đủ "Thuật ngữ — Định nghĩa"; path lạ (BE mới thêm field) ⇒ trả nguyên path để không mất giá trị. */
export const tableFieldLabel = (path: string): string => {
  const entity = entityOfPath(path);
  const group = TABLE_FIELD_GROUPS.find((g) => g.entity === entity);
  const field = group?.fields.find((f) => tableFieldPath(group.entity, f.field) === path);
  return group && field ? `${group.label} — ${field.label}` : path;
};
