import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ChatBubble from "./ChatBubble";

const content = JSON.stringify({ reply: "Mình hỏi thêm:", questions: [{ question: "Ai được nhập điểm?" }] });

describe("P05 - câu hỏi đã trả lời thu gọn", () => {
  it("answered ⇒ dòng 'Đã trả lời: …', danh sách câu hỏi không đánh số", () => {
    renderWithIntl(<ChatBubble message={{ role: "assistant", content } as never} answered="Giáo viên bộ môn" />);
    expect(screen.getByText("Đã trả lời: Giáo viên bộ môn")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Câu hỏi của AI", hidden: true }).tagName).toBe("UL");
  });
  it("chưa trả lời ⇒ vẫn danh sách đánh số như cũ", () => {
    renderWithIntl(<ChatBubble message={{ role: "assistant", content } as never} />);
    expect(screen.getByRole("list", { name: "Câu hỏi của AI" }).tagName).toBe("OL");
  });
});
