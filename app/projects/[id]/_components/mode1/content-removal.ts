import type { CrLocation } from "@/types/change-request";

/**
 * FLF-483 (lát M1-b): CR dừng ở "Sẵn sàng gửi" vì thay đổi xoá nội dung thì nói rõ xoá gì. Định nghĩa khớp BE
 * (`removedItems`): op `remove` hoặc mục con có `id` biến mất sau op `set`. Mảng chuỗi ngắn đi là sửa câu, không tính.
 * Chỉ in nhãn người đọc được (tên / câu), không in mã nội bộ.
 */

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

const LABEL_FIELDS = ["name", "title", "term", "condition", "text", "description", "statement", "content", "message", "action", "label", "rule"] as const;

const labelOf = (value: unknown): string => {
  if (!isRow(value)) return "";
  const text = LABEL_FIELDS.map((f) => value[f]).find((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (!text) return "";
  const t = text.trim();
  return t.length > 120 ? `${t.slice(0, 117)}...` : t;
};

/** Mọi object có `id` nằm trong mảng bên dưới `value`, khoá theo đường field + id. */
const idItems = (value: unknown, trail = "", out = new Map<string, unknown>()): Map<string, unknown> => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hasId = isRow(item) && item.id !== undefined && item.id !== null;
      const key = hasId ? `${trail}#${String((item as Row).id)}` : trail;
      if (hasId) out.set(key, item);
      idItems(item, key, out);
    }
  } else if (isRow(value)) {
    for (const [k, v] of Object.entries(value)) idItems(v, `${trail}.${k}`, out);
  }
  return out;
};

const parse = (text: string | null | undefined): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Nhãn các mục bị xoá của một vị trí (rỗng ⇒ vị trí không xoá gì). */
export function removedOf(location: CrLocation): string[] {
  const proposal = location.proposal;
  if (!proposal || location.conclusion === "not_related") return [];
  const fallback = location.display?.label || location.section_title;
  const removesElement = location.display?.change === "remove" || proposal.spine_ops.some((op) => isRow(op) && op.op === "remove");
  if (removesElement) return [fallback];
  const before = parse(proposal.old_text);
  const after = parse(proposal.new_text);
  if (before === undefined || after === undefined || after === null) return [];
  const kept = idItems(after);
  const out: string[] = [];
  for (const [key, item] of idItems(before)) if (!kept.has(key)) out.push(labelOf(item) || fallback);
  return out;
}

/** Nhãn các mục bị xoá của cả CR, bỏ trùng, giữ thứ tự. */
export function removedOfAll(locations: readonly CrLocation[]): string[] {
  return [...new Set(locations.flatMap(removedOf))];
}
