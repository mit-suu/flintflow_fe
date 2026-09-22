import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import ChatSessionHistory from "../ChatSessionHistory";
import type { ChatSession } from "@/types/chat";

const session = (id: string, content?: string) =>
  ({ _id: id, messages: content ? [{ role: "ai", content, createdAt: "2026-09-01T00:00:00Z" }] : [] }) as unknown as ChatSession;

const SESSIONS = [session("aaaa1111", '{"reply":"Xin chào"}'), session("bbbb2222")];

const setup = () => {
  const props = { onSelectSession: vi.fn(), onCreateSession: vi.fn(), onDeleteSession: vi.fn() };
  renderWithIntl(<ChatSessionHistory sessions={SESSIONS} activeSessionId="aaaa1111" {...props} />);
  return props;
};

describe("ChatSessionHistory", () => {
  it("đóng mặc định; bấm nút mới mở danh sách, chọn phiên thì đóng lại", () => {
    const { onSelectSession } = setup();
    expect(screen.queryByRole("dialog", { name: "Lịch sử phiên chat" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    const panel = screen.getByRole("dialog", { name: "Lịch sử phiên chat" });
    expect(within(panel).getByText("Xin chào")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /Phiên #1111/ })).toHaveAttribute("aria-current", "true");

    fireEvent.click(within(panel).getByRole("button", { name: /Phiên #2222/ }));
    expect(onSelectSession).toHaveBeenCalledWith(SESSIONS[1]);
    expect(screen.queryByRole("dialog", { name: "Lịch sử phiên chat" })).not.toBeInTheDocument();
  });

  it("Esc đóng popover; xoá phiên phải xác nhận", () => {
    const { onDeleteSession } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Lịch sử phiên chat" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Xoá phiên #2222" }));
    expect(onDeleteSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xoá phiên" }));
    expect(onDeleteSession).toHaveBeenCalledWith("bbbb2222");
  });
});
