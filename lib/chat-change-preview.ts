import type { PreviewResult } from "@/types/pipeline";

/** Tin chat mang bản xem trước: lệnh sửa thường, lệnh nhiều ý (phần rõ đi cùng câu hỏi), hoặc đã tự ghi theo mức duyệt. */
const PREVIEW_KINDS = new Set(["change_preview", "change_clarification", "change_applied"]);

/**
 * `finish.data` của luồng chat khi BE nhận tin là lệnh sửa: `{ kind, preview }`. Chỉ trả bản xem trước dùng được
 * (có `preview_id` hoặc đã `auto_applied`, có thay đổi) — còn lại `null`, chat giữ nguyên như tin thường.
 */
export const chatChangePreview = (data: unknown): PreviewResult | null => {
  if (data === null || typeof data !== "object") return null;
  const { kind, preview } = data as { kind?: unknown; preview?: unknown };
  if (typeof kind !== "string" || !PREVIEW_KINDS.has(kind) || preview === null || typeof preview !== "object") return null;
  const candidate = preview as Partial<PreviewResult>;
  if (candidate.ok !== true || !Array.isArray(candidate.changes) || candidate.changes.length === 0) return null;
  if (typeof candidate.preview_id !== "string" && candidate.auto_applied !== true) return null;
  return candidate as PreviewResult;
};
