import type { QuestionOption } from "./pipeline";

export interface ChatMessage {
  role: "user" | "ai";
  content: string;
  step?: string;
  discoveryStep?: number;
  createdAt: string;
}

export interface ChatSession {
  _id: string;
  projectId: string;
  messages: ChatMessage[];
  isActive: boolean;
  /** Bất biến 7: đúng một session pipeline mỗi project; session khác chỉ hỏi đáp (CHAT). */
  is_pipeline?: boolean;
  createdAt: string;
}

/** ActionType của BE dùng cho chat; quyết định giá credit mỗi tin nhắn. */
/** `change_instruction`: lệnh sửa tài liệu gõ ở ô chat (chip "Sửa tài liệu"). */
export type ChatActionType = "chat" | "change_instruction";

/** Câu hỏi đã chuẩn hoá cho thẻ hỏi — chung cho CHAT (`questions[]`) và `answer_needed` của step. */
export interface DiscoveryQuestion {
  question: string;
  header?: string;
  /** Rỗng ⇒ câu mở (trả lời bằng ô chat, không vào thẻ). */
  options: QuestionOption[];
  multiple?: boolean;
}

export interface ActionCostEstimate {
  actionType: string;
  cost: number;
}
