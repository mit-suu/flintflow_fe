import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { MESSAGES, VIETNAMESE, renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import ChatOpening from "../ChatOpening";
import type { ChatOpeningChipKey } from "../chat-opening.constants";

const GREETING_VI =
  "Chào bạn! Kể cho mình nghe ý tưởng phần mềm bạn muốn làm — ai sẽ dùng, dùng để làm gì, vì sao bạn muốn làm nó. Kể được bao nhiêu cứ kể, mình chỉ hỏi thêm phần còn thiếu.";

/** Nhãn + câu gửi đi của chip ý tưởng ở bản vi — nguyên văn như trước khi chuyển sang messages. */
const IDEAS_VI = [
  ["Quản lý công việc cho một nhóm nhỏ", "Mình muốn làm một ứng dụng giúp một nhóm nhỏ giao việc, theo dõi tiến độ và nhắc hạn cho nhau."],
  ["Số hoá một quy trình đang làm bằng giấy/Excel", "Mình muốn số hoá một quy trình hiện đang làm bằng giấy tờ và Excel để bớt nhập tay và dễ tra cứu."],
  [
    "Kết nối người cần dịch vụ với người cung cấp",
    "Mình muốn làm một nền tảng kết nối người cần một dịch vụ với người cung cấp dịch vụ đó, có đặt lịch và đánh giá.",
  ],
] as const;

/** Thứ tự chip trên màn: ba ý tưởng rồi chip "chưa có ý tưởng". */
const CHIP_KEYS: readonly ChatOpeningChipKey[] = ["teamTasks", "digitize", "marketplace", "noIdea"];

describe("ChatOpening (FLF-221)", () => {
  it("vi giữ nguyên văn câu chữ (e2e tìm theo 'Bắt đầu dự án'); bấm chip gửi câu của chip, chip 'chưa có ý tưởng' mang intent no_idea", () => {
    const onPick = vi.fn();
    renderWithIntl(<ChatOpening onPick={onPick} />);

    expect(screen.getByRole("region", { name: "Bắt đầu dự án" })).toBeInTheDocument();
    expect(screen.getByText(GREETING_VI)).toBeInTheDocument();
    expect(screen.getByText("Hoặc bắt đầu từ một gợi ý:")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Gợi ý bắt đầu" });

    for (const [label, message] of IDEAS_VI) {
      fireEvent.click(within(list).getByRole("button", { name: label }));
      expect(onPick).toHaveBeenLastCalledWith({ message });
    }
    fireEvent.click(within(list).getByRole("button", { name: "Mình chưa có ý tưởng" }));
    expect(onPick).toHaveBeenLastCalledWith({ message: "Mình chưa có ý tưởng cụ thể.", intent: "no_idea" });
    expect(onPick).toHaveBeenCalledTimes(4);
  });

  it("en (FLF-260): không còn chữ tiếng Việt; chip gửi câu tiếng Anh để BE trả lời bằng tiếng Anh", () => {
    const onPick = vi.fn();
    const { container } = renderWithIntl(<ChatOpening onPick={onPick} />, "en");

    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(screen.getByRole("region", { name: "Start your project" })).toBeInTheDocument();
    expect(screen.getByText(/^Hi there! Tell me about the software you want to build/)).toBeInTheDocument();
    const chips = within(screen.getByRole("list", { name: "Suggestions to get started" })).getAllByRole("button");
    expect(chips).toHaveLength(CHIP_KEYS.length);

    chips.forEach((chip) => fireEvent.click(chip));
    const { chips: texts } = MESSAGES.en.workspace.chatOpening;
    // Gửi `message` (câu trọn vẹn), không phải nhãn nút
    expect(onPick.mock.calls.map(([pick]) => pick)).toEqual(
      CHIP_KEYS.map((key) => ({ message: texts[key].message, ...(key === "noIdea" ? { intent: "no_idea" } : {}) }))
    );
    expect(onPick).toHaveBeenLastCalledWith({ message: "I don't have a specific idea yet.", intent: "no_idea" });
    expect(onPick.mock.calls.filter(([pick]) => VIETNAMESE.test(pick.message))).toEqual([]);
  });

  it("AI đang làm ⇒ mọi chip bị khoá, bấm không gửi gì", () => {
    const onPick = vi.fn();
    renderWithIntl(<ChatOpening onPick={onPick} disabled />);
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(CHIP_KEYS.length);
    chips.forEach((chip) => expect(chip).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Mình chưa có ý tưởng" }));
    expect(onPick).not.toHaveBeenCalled();
  });
});
