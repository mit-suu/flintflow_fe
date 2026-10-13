/**
 * Comment ghim vào nội dung SRS (UC-49) — endpoint 28, 29, 31 của `pipeline-contract.md`.
 *
 * Trả lời comment (endpoint 30) chưa dùng ở FE: `business-flow.md §3.5` chốt mức tối thiểu là
 * "comment ghim theo section / phần nội dung, không cần thread trả lời".
 */
import type { Comment, CommentResolutionInput, CreateCommentInput } from "@/types/comment";
import { apiCall } from "./client";

/** `status` mặc định `open` ở BE; truyền `all` để xem cả comment đã xử lý. */
export const listComments = (projectId: string, status: "open" | "all" = "open") =>
  apiCall<Comment[]>(`/projects/${projectId}/comments?status=${status}`);

/** Nhãn và đoạn trích của chỗ ghim do BE dựng từ đúng bản đang đọc — FE không tự đặt. */
export const createComment = (projectId: string, input: CreateCommentInput) =>
  apiCall<Comment>(`/projects/${projectId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/**
 * Kết luận một comment (Lead/Analyst) theo hai nhánh của `business-flow.md §3.5`: `fixed` đã sửa qua chat,
 * `kept` giữ nguyên **kèm lý do** (BE từ chối nếu lý do rỗng hoặc quá ngắn).
 *
 * BE mở lại bước sở hữu mục được ghim khi bước đó đang Accept (UC-47) — gọi xong phải tải lại Spine để
 * tiến độ hiện đúng.
 */
export const resolveComment = (projectId: string, commentId: string, resolution: CommentResolutionInput) =>
  apiCall<Comment>(`/projects/${projectId}/comments/${commentId}/resolve`, {
    method: "POST",
    body: JSON.stringify(resolution),
  });
