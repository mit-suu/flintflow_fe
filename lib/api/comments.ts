/**
 * Comment ghim vào nội dung SRS (UC-49) — contract `pipeline-contract.md` endpoint 28–31. Tạo change request từ
 * comment đi qua `createCr` (`comment_id`), không có endpoint riêng.
 */
import type { CommentResolutionInput, CreateCommentRequest, SrsComment } from "@/types/comment";
import { apiCall } from "./client";

const comments = (projectId: string) => `/projects/${projectId}/comments`;

/** Cũ trước. `all` gồm cả comment đã xử lý / đã chuyển CR (tab "Đã đóng" của trang đọc). */
export const listComments = (projectId: string, status: "open" | "all" = "open") =>
  apiCall<SrsComment[]>(`${comments(projectId)}?status=${status}`);

/** Nhãn và đoạn trích của chỗ ghim do BE dựng từ đúng bản đang đọc — FE không tự đặt. */
export const createComment = (projectId: string, body: CreateCommentRequest) =>
  apiCall<SrsComment>(comments(projectId), { method: "POST", body: JSON.stringify(body) });

export const replyComment = (projectId: string, commentId: string, text: string) =>
  apiCall<SrsComment>(`${comments(projectId)}/${commentId}/replies`, { method: "POST", body: JSON.stringify({ text }) });

/**
 * Kết luận một comment (Lead/Analyst) theo hai nhánh của `business-flow.md §3.5`: `fixed` đã sửa qua chat,
 * `kept` giữ nguyên **kèm lý do** (BE từ chối nếu lý do rỗng hoặc quá ngắn).
 *
 * BE mở lại bước sở hữu mục được ghim khi bước đó đang Accept (UC-47) — gọi xong phải tải lại Spine để
 * tiến độ hiện đúng.
 */
export const resolveComment = (projectId: string, commentId: string, resolution: CommentResolutionInput) =>
  apiCall<SrsComment>(`${comments(projectId)}/${commentId}/resolve`, { method: "POST", body: JSON.stringify(resolution) });
