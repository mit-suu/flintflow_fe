import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ChatInput from "./ChatInput";

const props = {
  inputMessage: "",
  setInputMessage: () => {},
  onSendMessage: () => {},
  sending: false,
  pendingAttachments: [],
  onSelectAttachment: () => {},
  onRemoveAttachment: () => {},
};

// Credit chỉ còn ở header (WorkspaceHeader): ô nhập không hiện giá mỗi tin hay số dư, cũng không gọi BE ước giá.
describe("ChatInput — không hiện credit", () => {
  it("ô nhập thường và thu gọn đều không có chữ credit / msg / còn N", () => {
    const { container, rerender } = renderWithIntl(<ChatInput {...props} />);
    expect(container).not.toHaveTextContent(/credit|\/ msg|còn \d/);
    rerender(<ChatInput {...props} compact />);
    expect(container).not.toHaveTextContent(/credit|\/ msg|còn \d/);
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeInTheDocument();
  });

  it("dùng placeholder được truyền vào (cổng chốt nhắc bạn nhắn để sửa)", () => {
    renderWithIntl(<ChatInput {...props} placeholder="Muốn sửa gì thì bạn nhắn tôi nhé…" />);
    expect(screen.getByPlaceholderText("Muốn sửa gì thì bạn nhắn tôi nhé…")).toBeInTheDocument();
  });
});

// FLF-279: chip "Hỏi kiến thức BA" đứng cạnh chip "Sửa tài liệu" — hai chế độ gửi phải thấy được cùng lúc.
describe("ChatInput — chip Hỏi kiến thức BA", () => {
  const chip = () => screen.queryByRole("button", { name: /Hỏi kiến thức BA/ });

  it("chỉ hiện khi có handler, và ẩn khi thu gọn hoặc khi máy chủ tắt tính năng", () => {
    const { rerender } = renderWithIntl(<ChatInput {...props} />);
    expect(chip()).not.toBeInTheDocument();

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} />);
    expect(chip()).toBeInTheDocument();

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} knowledgeHidden />);
    expect(chip()).not.toBeInTheDocument();
  });

  // Thu gọn = đang có thẻ hỏi của bước, mà đó chính là lúc hay hỏi kiến thức nhất. Ẩn chip ở đó thì chế
  // độ gửi đang bật không còn tín hiệu nào và câu trả lời bước bị gửi thành câu hỏi tri thức.
  it("thu gọn vẫn hiện chip, chỉ bỏ nhãn chữ", () => {
    renderWithIntl(<ChatInput {...props} onToggleKnowledgeMode={() => {}} knowledgeMode compact />);
    const button = chip()!;
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.textContent).toBe("");
  });

  it("bật chế độ tri thức ⇒ ẩn nút đính kèm (gửi chỉ có file là câu hỏi vô nghĩa vẫn tốn credit)", () => {
    const { rerender } = renderWithIntl(<ChatInput {...props} onToggleKnowledgeMode={() => {}} />);
    expect(screen.getByLabelText("Đính kèm tài liệu tham khảo")).not.toHaveAttribute("hidden");

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} knowledgeMode />);
    expect(screen.getByLabelText("Đính kèm tài liệu tham khảo")).toHaveAttribute("hidden");
  });

  it("aria-pressed theo knowledgeMode và bấm thì gọi handler", () => {
    const onToggleKnowledgeMode = vi.fn();
    const { rerender } = renderWithIntl(<ChatInput {...props} onToggleKnowledgeMode={onToggleKnowledgeMode} />);
    expect(chip()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip()!);
    expect(onToggleKnowledgeMode).toHaveBeenCalledTimes(1);

    rerender(<ChatInput {...props} onToggleKnowledgeMode={onToggleKnowledgeMode} knowledgeMode />);
    expect(chip()).toHaveAttribute("aria-pressed", "true");
  });

  it("hiện cùng lúc với chip Sửa tài liệu", () => {
    renderWithIntl(<ChatInput {...props} onToggleEditMode={() => {}} onToggleKnowledgeMode={() => {}} />);
    expect(screen.getByRole("button", { name: /Sửa tài liệu/ })).toBeInTheDocument();
    expect(chip()).toBeInTheDocument();
  });
});

// Dừng AI như Esc của Claude Code: đang chạy ⇒ nút gửi thành nút dừng, Esc ở đâu trong trang cũng dừng.
describe("ChatInput — dừng AI", () => {
  it("đang chạy và có onStop ⇒ nút Dừng AI thay nút gửi, bấm thì gọi onStop", () => {
    const onStop = vi.fn();
    renderWithIntl(<ChatInput {...props} sending onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Gửi tin nhắn" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dừng AI" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("Esc dừng khi đang chạy (ô gõ đang khoá nên nghe ở cửa sổ); hết chạy thì Esc không làm gì", () => {
    const onStop = vi.fn();
    const { rerender } = renderWithIntl(<ChatInput {...props} sending onStop={onStop} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onStop).toHaveBeenCalledTimes(1);

    rerender(<ChatInput {...props} sending={false} onStop={onStop} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("không có onStop ⇒ giữ nút gửi có spinner như cũ", () => {
    renderWithIntl(<ChatInput {...props} sending />);
    expect(screen.queryByRole("button", { name: "Dừng AI" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
  });
});
