import type { ReviewMode } from "@/types/spine";
import type { AutoPassedResponse, ReviewModeResponse, SkipConfirmSectionsResponse } from "@/types/review-level";
import { apiCall } from "./client";

/**
 * FLF-337: đổi mức duyệt (`project.review_mode`) qua endpoint riêng — dùng được cả ở mode 1 (sau baseline `/changes` bị chặn
 * `CHANGE_REQUIRES_CR`). Có hiệu lực từ bước / CR kế tiếp.
 */
export const setReviewMode = (projectId: string, review_mode: ReviewMode) =>
  apiCall<ReviewModeResponse>(`/projects/${projectId}/review-mode`, { method: "PATCH", body: JSON.stringify({ review_mode }) });

/** "Chấp nhận, không hỏi lại phần này": thêm / gỡ section khỏi danh sách tự qua. */
export const patchSkipConfirmSections = (projectId: string, body: { add?: string[]; remove?: string[] }) =>
  apiCall<SkipConfirmSectionsResponse>(`/projects/${projectId}/skip-confirm-sections`, { method: "PATCH", body: JSON.stringify(body) });

/** Thay đổi AI tự qua, kèm số "chưa xem" của người gọi. */
export const listAutoPassed = (projectId: string) => apiCall<AutoPassedResponse>(`/projects/${projectId}/auto-passed`);

/** Đánh dấu đã xem; `ids` rỗng / thiếu ⇒ tất cả. */
export const markAutoPassedSeen = (projectId: string, ids?: string[]) =>
  apiCall<{ unseen: number }>(`/projects/${projectId}/auto-passed/seen`, { method: "POST", body: JSON.stringify(ids?.length ? { ids } : {}) });
