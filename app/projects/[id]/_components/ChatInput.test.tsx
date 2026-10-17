import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    const { container, rerender } = render(<ChatInput {...props} />);
    expect(container).not.toHaveTextContent(/credit|\/ msg|còn \d/);
    rerender(<ChatInput {...props} compact />);
    expect(container).not.toHaveTextContent(/credit|\/ msg|còn \d/);
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeInTheDocument();
  });

  it("dùng placeholder được truyền vào (cổng chốt nhắc bạn nhắn để sửa)", () => {
    render(<ChatInput {...props} placeholder="Muốn sửa gì thì bạn nhắn tôi nhé…" />);
    expect(screen.getByPlaceholderText("Muốn sửa gì thì bạn nhắn tôi nhé…")).toBeInTheDocument();
  });
});

// FLF-279: chip "Hỏi kiến thức BA" đứng cạnh chip "Sửa tài liệu" — hai chế độ gửi phải thấy được cùng lúc.
describe("ChatInput — chip Hỏi kiến thức BA", () => {
  const chip = () => screen.queryByRole("button", { name: /Hỏi kiến thức BA/ });

  it("chỉ hiện khi có handler, và ẩn khi thu gọn hoặc khi máy chủ tắt tính năng", () => {
    const { rerender } = render(<ChatInput {...props} />);
    expect(chip()).not.toBeInTheDocument();

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} />);
    expect(chip()).toBeInTheDocument();

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} compact />);
    expect(chip()).not.toBeInTheDocument();

    rerender(<ChatInput {...props} onToggleKnowledgeMode={() => {}} knowledgeHidden />);
    expect(chip()).not.toBeInTheDocument();
  });

  it("aria-pressed theo knowledgeMode và bấm thì gọi handler", () => {
    const onToggleKnowledgeMode = vi.fn();
    const { rerender } = render(<ChatInput {...props} onToggleKnowledgeMode={onToggleKnowledgeMode} />);
    expect(chip()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip()!);
    expect(onToggleKnowledgeMode).toHaveBeenCalledTimes(1);

    rerender(<ChatInput {...props} onToggleKnowledgeMode={onToggleKnowledgeMode} knowledgeMode />);
    expect(chip()).toHaveAttribute("aria-pressed", "true");
  });

  it("hiện cùng lúc với chip Sửa tài liệu", () => {
    render(<ChatInput {...props} onToggleEditMode={() => {}} onToggleKnowledgeMode={() => {}} />);
    expect(screen.getByRole("button", { name: /Sửa tài liệu/ })).toBeInTheDocument();
    expect(chip()).toBeInTheDocument();
  });
});
