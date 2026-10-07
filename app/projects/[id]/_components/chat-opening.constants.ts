/**
 * Màn mở đầu của project mới (FLF-221). Chữ đi theo ngôn ngữ giao diện (FLF-260) nên nằm ở `messages/<locale>.json` →
 * `workspace.chatOpening`; ở đây chỉ giữ key và intent của từng chip. Bộ chip cố định, chung chung, không thiên về lĩnh
 * vực nào — chỉ để user mới thấy "có thể kể gì".
 */
import type { RunIntent } from "@/types/pipeline";

/** Key của chip trong `workspace.chatOpening.chips` — mỗi chip có `label` (nhãn nút) và `message` (tin gửi đi). */
export type ChatOpeningChipKey = "teamTasks" | "digitize" | "marketplace" | "noIdea";

export interface ChatOpeningChip {
  key: ChatOpeningChipKey;
  intent?: RunIntent;
}

/** Chip đã dịch, trao cho trang khi bấm. */
export interface ChatOpeningPick {
  /** Nội dung gửi đi khi bấm chip — đi theo đúng đường của một tin chat; BE lấy ngôn ngữ trả lời từ câu này. */
  message: string;
  intent?: RunIntent;
}

export const CHAT_OPENING_IDEAS: readonly ChatOpeningChip[] = [{ key: "teamTasks" }, { key: "digitize" }, { key: "marketplace" }];

/** Chip cuối: không gửi ý tưởng nào — server hỏi gợi mở bằng văn xuôi (không dò chữ trong tin nhắn). */
export const CHAT_OPENING_NO_IDEA: ChatOpeningChip = { key: "noIdea", intent: "no_idea" };
