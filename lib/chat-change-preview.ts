import type { PreviewResult } from "@/types/pipeline";

/**
 * `finish.data` của luồng chat khi BE nhận tin là lệnh sửa: `{ kind: "change_preview", preview }`. Chỉ trả bản xem
 * trước dùng được (có `preview_id`, có thay đổi) — còn lại `null`, chat giữ nguyên như tin thường.
 */
export const chatChangePreview = (data: unknown): PreviewResult | null => {
  if (data === null || typeof data !== "object") return null;
  const { kind, preview } = data as { kind?: unknown; preview?: unknown };
  if (kind !== "change_preview" || preview === null || typeof preview !== "object") return null;
  const candidate = preview as Partial<PreviewResult>;
  if (candidate.ok !== true || typeof candidate.preview_id !== "string" || !Array.isArray(candidate.changes) || candidate.changes.length === 0) {
    return null;
  }
  return candidate as PreviewResult;
};
