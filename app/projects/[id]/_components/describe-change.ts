/**
 * Đổi một thay đổi thô của Spine (`set actors[id=A03].name`) thành câu người đọc được
 * ("Sửa Actor A03 · name: Admin → Administrator"). Dùng cho thẻ sửa trong chat và "Lịch sử sửa".
 */

interface ChangeLike {
  op: string;
  path: string;
  before: unknown;
  value: unknown;
}

const COLLECTION_LABEL: Record<string, string> = {
  project: "Dự án",
  actors: "Actor",
  use_cases: "Use case",
  features: "Feature",
  screens: "Màn hình",
  functions: "Function",
  entities: "Thực thể",
  nfrs: "Yêu cầu phi chức năng",
  business_rules: "Business rule",
  messages: "Thông báo",
  glossary: "Thuật ngữ",
  permissions: "Phân quyền",
  assumptions: "Giả định",
  decisions: "Quyết định",
};

const OP_LABEL: Record<string, string> = { set: "Sửa", add: "Thêm", remove: "Xoá", renumber: "Đánh số lại" };

/** Rút gọn giá trị để hiện trên một dòng. */
export const shortValue = (value: unknown, max = 60): string => {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/** Đầu câu: "Sửa Actor A03 · name". */
export const describeTarget = (change: ChangeLike): string => {
  const [root, ...rest] = change.path.split(".");
  const collection = root.replace(/\[.*$/, "");
  const key = /\[(?:[a-z_]+=)?([^\],]+)/.exec(root)?.[1];
  const label = COLLECTION_LABEL[collection] ?? collection;
  const field = rest.join(".").replace(/\[(?:[a-z_]+=)?([^\]]+)\]/g, " $1");
  const verb = OP_LABEL[change.op] ?? change.op;
  return [`${verb} ${label}${key ? ` ${key}` : ""}`, field].filter(Boolean).join(" · ");
};

/** Câu đầy đủ kèm giá trị trước → sau. */
export const describeChange = (change: ChangeLike): string => {
  const target = describeTarget(change);
  if (change.op === "add") return `${target}: ${shortValue(change.value)}`;
  if (change.op === "remove") return target;
  return `${target}: ${shortValue(change.before)} → ${shortValue(change.value)}`;
};
