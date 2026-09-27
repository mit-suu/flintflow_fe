/**
 * Màn mở đầu của project mới (FLF-221). Workspace chưa chuyển i18n (xem FE `CLAUDE.md`) nên chuỗi nằm ở đây, không
 * viết thẳng trong JSX. Bộ chip cố định, chung chung, không thiên về lĩnh vực nào — chỉ để user mới thấy "có thể kể gì".
 */
import type { RunIntent } from "@/types/pipeline";

/** Lời chào cố định: hiện ngay, không gọi model, 0 credit. */
export const CHAT_OPENING_GREETING =
  "Chào bạn! Kể cho mình nghe ý tưởng phần mềm bạn muốn làm — ai sẽ dùng, dùng để làm gì, vì sao bạn muốn làm nó. Kể được bao nhiêu cứ kể, mình chỉ hỏi thêm phần còn thiếu.";

export const CHAT_OPENING_HINT = "Hoặc bắt đầu từ một gợi ý:";

export interface ChatOpeningChip {
  label: string;
  /** Nội dung gửi đi khi bấm chip — đi theo đúng đường của một tin chat. */
  message: string;
  intent?: RunIntent;
}

export const CHAT_OPENING_IDEAS: readonly ChatOpeningChip[] = [
  {
    label: "Quản lý công việc cho một nhóm nhỏ",
    message: "Mình muốn làm một ứng dụng giúp một nhóm nhỏ giao việc, theo dõi tiến độ và nhắc hạn cho nhau.",
  },
  {
    label: "Số hoá một quy trình đang làm bằng giấy/Excel",
    message: "Mình muốn số hoá một quy trình hiện đang làm bằng giấy tờ và Excel để bớt nhập tay và dễ tra cứu.",
  },
  {
    label: "Kết nối người cần dịch vụ với người cung cấp",
    message: "Mình muốn làm một nền tảng kết nối người cần một dịch vụ với người cung cấp dịch vụ đó, có đặt lịch và đánh giá.",
  },
];

/** Chip cuối: không gửi ý tưởng nào — server hỏi gợi mở bằng văn xuôi (không dò chữ trong tin nhắn). */
export const CHAT_OPENING_NO_IDEA: ChatOpeningChip = {
  label: "Mình chưa có ý tưởng",
  message: "Mình chưa có ý tưởng cụ thể.",
  intent: "no_idea",
};
