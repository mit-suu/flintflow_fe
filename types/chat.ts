import type { WorkspacePhase } from "@/lib/constants/section-types";
import type { SectionItem } from "./document";
import type { Project } from "./project";

export interface ChatMessage {
  role: "user" | "ai";
  content: string;
  step?: string;
  discoveryStep?: number;
  workspacePhase?: string;
  createdAt: string;
}

export interface ChatSession {
  _id: string;
  projectId: string;
  messages: ChatMessage[];
  isActive: boolean;
  createdAt: string;
}

/** Kết quả `POST /projects/:id/chats/:chatId/rollback` (legacy, section-based). */
export interface ChatRollbackResult {
  session: ChatSession;
  project: Project;
  sections: SectionItem[];
  workspacePhase: WorkspacePhase;
}

/** ActionType của BE dùng cho chat; quyết định giá credit mỗi tin nhắn. */
export type ChatActionType = "chat" | "chat_discovery";

export interface ActionCostEstimate {
  actionType: string;
  cost: number;
}
