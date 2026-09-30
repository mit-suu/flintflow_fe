import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
