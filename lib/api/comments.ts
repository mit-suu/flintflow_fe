/**
 * Comment ghim vào nội dung SRS (UC-49) — contract `pipeline-contract.md` endpoint 26–29. Tạo change request từ
 * comment đi qua `createCr` (`comment_id`), không có endpoint riêng.
 */
import type { CreateCommentRequest, SrsComment } from "@/types/comment";
import { apiCall } from "./client";

const comments = (projectId: string) => `/projects/${projectId}/comments`;

/** Cũ trước. `all` gồm cả comment đã xử lý / đã chuyển CR (tab "Đã đóng" của trang đọc). */
export const listComments = (projectId: string, status: "open" | "all" = "open") =>
  apiCall<SrsComment[]>(`${comments(projectId)}?status=${status}`);

export const createComment = (projectId: string, body: CreateCommentRequest) =>
  apiCall<SrsComment>(comments(projectId), { method: "POST", body: JSON.stringify(body) });

export const replyComment = (projectId: string, commentId: string, text: string) =>
  apiCall<SrsComment>(`${comments(projectId)}/${commentId}/replies`, { method: "POST", body: JSON.stringify({ text }) });

/** Analyst / Lead: đánh dấu đã xử lý mà không đổi nội dung. */
export const resolveComment = (projectId: string, commentId: string) =>
  apiCall<SrsComment>(`${comments(projectId)}/${commentId}/resolve`, { method: "POST" });
