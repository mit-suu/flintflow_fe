import type { ActionCostEstimate, ChatActionType, ChatSession } from "@/types/chat";
import { apiCall } from "./client";

export const listChatSessions = (projectId: string) =>
  apiCall<ChatSession[]>(`/projects/${projectId}/chats`);

export const createChatSession = (projectId: string) =>
  apiCall<ChatSession>(`/projects/${projectId}/chats`, { method: "POST" });

export const getChatSession = (projectId: string, chatId: string) =>
  apiCall<ChatSession>(`/projects/${projectId}/chats/${chatId}`);

export const deleteChatSession = (projectId: string, chatId: string) =>
  apiCall<{ message: string }>(`/projects/${projectId}/chats/${chatId}`, { method: "DELETE" });

// T23: gỡ `rollbackChat`. Rollback cũ cắt transcript và xoá version — phá huỷ, không khôi phục được
// (audit C2). Thay bằng `POST /projects/:id/undo` (T17, `lib/api/spine.ts#undoLastChange`): revert cả lô
// thay đổi gần nhất bằng `changes[].before`, không xoá gì. Endpoint cũ còn trên BE tới khi T21 xoá, nhưng
// FE không gọi nữa — không component nào dùng hàm này từ khi T16 thay ConfirmRollbackModal.

/** Giá credit của một lần gọi AI theo ActionType (BE đọc bảng giá đang active). */
export const estimateActionCost = (actionType: ChatActionType) =>
  apiCall<ActionCostEstimate>("/ai-actions/estimate-cost", {
    method: "POST",
    body: JSON.stringify({ actionType }),
  });
