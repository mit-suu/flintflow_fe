import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ChatToolbarTip from "./ChatToolbarTip";

const focusTrigger = async (name: string) => {
  // Radix mở tooltip khi trigger (khung bọc) nhận focus
  const trigger = screen.getByRole("button", { name }).parentElement!;
  await act(async () => {
    fireEvent.focus(trigger);
  });
};

describe("ChatToolbarTip", () => {
  it("nút chỉ có icon ⇒ tooltip kèm tên nút; gợi ý gắn làm mô tả của nút", async () => {
    render(
      <ChatToolbarTip label="Hỏi kiến thức BA" hint="Trả lời có trích dẫn nguồn">
        {(describedBy) => <button type="button" aria-label="Hỏi kiến thức BA" aria-describedby={describedBy} />}
      </ChatToolbarTip>,
    );
    expect(screen.getByRole("button", { name: "Hỏi kiến thức BA" })).toHaveAccessibleDescription("Trả lời có trích dẫn nguồn");
    await focusTrigger("Hỏi kiến thức BA");
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Hỏi kiến thức BA");
    expect(tip).toHaveTextContent("Trả lời có trích dẫn nguồn");
  });

  it("nhãn đang hiện và không có gợi ý ⇒ không bật tooltip rỗng; menu mở ⇒ không tooltip", async () => {
    const { rerender } = render(
      <ChatToolbarTip label="Sửa tài liệu">
        {() => (
          <button type="button" aria-label="Sửa tài liệu">
            <span data-chip-label>Sửa tài liệu</span>
          </button>
        )}
      </ChatToolbarTip>,
    );
    await focusTrigger("Sửa tài liệu");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <ChatToolbarTip label="Mức duyệt" hint="Cách AI làm việc với bạn" disabled>
        {() => <button type="button" aria-label="Mức duyệt" />}
      </ChatToolbarTip>,
    );
    await focusTrigger("Mức duyệt");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
