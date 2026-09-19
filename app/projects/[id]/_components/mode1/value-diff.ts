/**
 * Đọc thay đổi của một vị trí CR (mode 1 v2 — FLF-186): `proposal.old_text` / `new_text` là giá trị phần tử Spine
 * dạng JSON. Tách thành danh sách field đổi để người duyệt đọc "trường: cũ → mới" thay vì so hai khối JSON.
 */

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

const parse = (text: string | null | undefined): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** Giá trị field để hiển thị: chuỗi giữ nguyên, còn lại JSON gọn; không có ⇒ "—". */
export const showValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
};

/** Field cấp đầu khác nhau giữa hai giá trị; không đọc được JSON ⇒ một dòng "giá trị" cho cả khối. */
export const fieldChanges = (oldText: string | null | undefined, newText: string | null | undefined): FieldChange[] => {
  const a = parse(oldText);
  const b = parse(newText);
  if (!a || !b) return oldText === newText ? [] : [{ field: "giá trị", before: oldText ?? "—", after: newText ?? "—" }];
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ field: k, before: showValue(a[k]), after: showValue(b[k]) }));
};

/** Tóm tắt phần tử: tên / câu phát biểu / thuật ngữ — để người đọc biết vị trí nói về gì. */
export const valueSummary = (text: string | null | undefined): string => {
  const v = parse(text);
  if (!v) return text ?? "";
  for (const k of ["name", "statement", "term", "heading", "vision", "text", "description"]) {
    if (typeof v[k] === "string" && (v[k] as string).trim()) return v[k] as string;
  }
  return "";
};
