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
  /** Bất biến 7: đúng một session pipeline mỗi project; session khác chỉ hỏi đáp (CHAT). */
  is_pipeline?: boolean;
  createdAt: string;
}

/** ActionType của BE dùng cho chat; quyết định giá credit mỗi tin nhắn. */
/** `change_instruction`: lệnh sửa tài liệu gõ ở ô chat (chip "Sửa tài liệu"). */
/** `knowledge_answer`: câu hỏi tri thức (chip "Hỏi kiến thức BA") — 2 credit, trả lời từ Knowledge RAG. */
export type ChatActionType = "chat" | "change_instruction" | "knowledge_answer";

/** `source_kind` của chunk tri thức (BE §1.2): hướng dẫn nội bộ FlintFlow, hay chuẩn ngoài. */
export type KnowledgeSourceKind = "internal_skill" | "standard";

/** Một chunk được trích trong câu trả lời tri thức. `ref` là nhãn `K1`, `K2`… model viết trong `reply`. */
export interface KnowledgeCitation {
  ref: string;
  chunk_id: string;
  source: string;
  section: string;
  source_kind: KnowledgeSourceKind;
}

/**
 * Tin AI của lượt hỏi tri thức: tin CHAT + `grounded` + `citations` (BE §1.2).
 *
 * `grounded: false` ⇒ `reply` là câu từ chối cố định của BE theo ngôn ngữ phiên và `citations` rỗng —
 * khác hẳn tin lỗi hệ thống, nên UI phải hiện hai hình khác nhau.
 *
 * `citations` chỉ gồm chunk thật sự được trích: nhãn model viết mà không có trong tập truy hồi đã bị BE
 * bỏ. Đừng giả định mọi `[Kn]` trong `reply` đều có phần tử khớp ở đây.
 */
export interface KnowledgeReply {
  reply: string;
  questions: never[];
  grounded: boolean;
  citations: KnowledgeCitation[];
}

/** Câu hỏi đã chuẩn hoá cho thẻ hỏi — chung cho CHAT (`questions[]`) và `answer_needed` của step. */
export interface DiscoveryQuestion {
  question: string;
  header?: string;
  /** Rỗng ⇒ câu mở (trả lời bằng ô chat, không vào thẻ). */
  options: QuestionOption[];
  multiple?: boolean;
  /** Câu mở đã được hỏi ngay trong lời AI — không hiện lại thành dòng/thẻ riêng. */
  inline?: boolean;
}

export interface ActionCostEstimate {
  actionType: string;
  cost: number;
}
