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

/** Giá credit của một lần gọi AI theo ActionType (BE đọc bảng giá đang active). */
export const estimateActionCost = (actionType: ChatActionType) =>
  apiCall<ActionCostEstimate>("/ai-actions/estimate-cost", {
    method: "POST",
    body: JSON.stringify({ actionType }),
  });
