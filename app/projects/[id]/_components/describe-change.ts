/**
 * Đổi một thay đổi thô của Spine (`set actors[id=A03].name`) thành câu người đọc được
 * ("Sửa Actor A03 · name: Admin → Administrator"). Dùng cho thẻ sửa trong chat và "Lịch sử sửa".
 */
import { fieldLabel, readableValue } from "./mode1/spine-labels";

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
  // Không JSON: object/mảng thành "Tên: …; Mô tả: …" (FLF-247)
  const text = readableValue(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/** Đầu câu: "Sửa Actor A03 · name". */
export const describeTarget = (change: ChangeLike): string => {
  const [root, ...rest] = change.path.split(".");
  const collection = root.replace(/\[.*$/, "");
  const key = /\[(?:[a-z_]+=)?([^\],]+)/.exec(root)?.[1];
  const label = COLLECTION_LABEL[collection] ?? collection;
  // Tên trường đời thường (`actor_ids` ⇒ "Tác nhân"); khoá trong ngoặc giữ lại (`flows[id=F1]` ⇒ "… F1")
  const field = rest
    .map((part) => part.replace(/^[a-z_]+/, (name) => fieldLabel(name)).replace(/\[(?:[a-z_]+=)?([^\]]+)\]/g, " $1"))
    .join(" › ");
  const verb = OP_LABEL[change.op] ?? "Sửa";
  return [`${verb} ${label}${key ? ` ${key}` : ""}`, field].filter(Boolean).join(" · ");
};

/** Câu đầy đủ kèm giá trị trước → sau. */
export const describeChange = (change: ChangeLike): string => {
  const target = describeTarget(change);
  if (change.op === "add") return `${target}: ${shortValue(change.value)}`;
  if (change.op === "remove") return target;
  return `${target}: ${shortValue(change.before)} → ${shortValue(change.value)}`;
};
