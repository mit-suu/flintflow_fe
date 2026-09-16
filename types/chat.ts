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
export type ChatActionType = "chat";

/** Câu hỏi có gợi ý trả lời — model phát trong `questions[]` của CHAT và `answer_needed` của step. */
export interface DiscoveryQuestion {
  question: string;
  suggestedAnswers: string[];
  multiple?: boolean;
}

export interface ActionCostEstimate {
  actionType: string;
  cost: number;
}
