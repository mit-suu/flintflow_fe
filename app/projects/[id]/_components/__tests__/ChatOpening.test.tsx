import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatOpening from "../ChatOpening";
import { CHAT_OPENING_GREETING, CHAT_OPENING_IDEAS, CHAT_OPENING_NO_IDEA } from "../chat-opening.constants";

describe("ChatOpening (FLF-221)", () => {
  it("lời chào cố định + chip ý tưởng; bấm chip là gửi, chip 'chưa có ý tưởng' mang intent no_idea", () => {
    const onPick = vi.fn();
    render(<ChatOpening onPick={onPick} />);
    expect(screen.getByText(CHAT_OPENING_GREETING)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: CHAT_OPENING_IDEAS[0].label }));
    expect(onPick).toHaveBeenLastCalledWith(CHAT_OPENING_IDEAS[0]);
    fireEvent.click(screen.getByRole("button", { name: CHAT_OPENING_NO_IDEA.label }));
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ intent: "no_idea" }));
  });

  it("AI đang làm ⇒ chip bị khoá", () => {
    render(<ChatOpening onPick={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: CHAT_OPENING_NO_IDEA.label })).toBeDisabled();
  });
});
