/**
 * Phần nhỏ `slot:*` (FLF-278 trên FLF-335/336) — bản sao danh mục của BE `src/modules/import/content-slots.ts`: heading của
 * mẫu khách nhận **một phần** dữ liệu Spine (mục đích, phạm vi, giả định…) thay vì cả mục FPT. Nhãn ở
 * `messages → common.fptSections.slots.<key>`.
 */
export interface ContentSlot {
  id: `slot:${string}`;
  /** Mục FPT gộp phần này — slot và mục cha không cùng có heading (in hai lần). */
  parents: readonly string[];
}

export const CONTENT_SLOTS: readonly ContentSlot[] = Object.freeze([
  { id: "slot:vision", parents: ["fixed:1"] },
  { id: "slot:goals", parents: ["fixed:1"] },
  { id: "slot:scope", parents: ["fixed:1"] },
  { id: "slot:high_rules", parents: ["fixed:1"] },
  { id: "slot:context", parents: ["fixed:1"] },
  { id: "slot:features", parents: [] },
  { id: "slot:platforms", parents: [] },
  { id: "slot:assumptions", parents: ["fixed:5.4"] },
  { id: "slot:risks", parents: ["fixed:5.4"] },
  { id: "slot:open_questions", parents: ["fixed:5.4"] },
  { id: "slot:security", parents: ["fixed:5.2"] },
  { id: "slot:localization", parents: ["fixed:5.2"] },
  { id: "slot:analysis_models", parents: ["fixed:2.2.1", "fixed:3.1.1", "fixed:3.1.5"] },
] as const);

export const isContentSlot = (id: string): boolean => CONTENT_SLOTS.some((s) => s.id === id);
export const slotKey = (id: string): string => id.slice("slot:".length);

/** Cặp (mục cha, slot) cùng được chọn ⇒ nội dung in hai lần (BE từ chối `IMPORT_INVALID_STATE`). */
export const slotOverlaps = (sectionIds: Iterable<string>): [string, string][] => {
  const used = new Set(sectionIds);
  return CONTENT_SLOTS.flatMap((s) => (used.has(s.id) ? s.parents.filter((p) => used.has(p)).map((p): [string, string] => [p, s.id]) : []));
};
