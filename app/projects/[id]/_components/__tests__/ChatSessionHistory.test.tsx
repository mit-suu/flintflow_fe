import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import ChatSessionHistory from "../ChatSessionHistory";
import type { ChatSession } from "@/types/chat";

const session = (id: string, content?: string) =>
  ({ _id: id, messages: content ? [{ role: "ai", content, createdAt: "2026-09-01T00:00:00Z" }] : [] }) as unknown as ChatSession;

const SESSIONS = [session("aaaa1111", '{"reply":"Xin chào"}'), session("bbbb2222")];

const setup = (extra: { pipelineSessionId?: string; createDisabled?: boolean; readOnly?: boolean } = {}) => {
  const props = { onSelectSession: vi.fn(), onCreateSession: vi.fn(), onDeleteSession: vi.fn() };
  renderWithIntl(<ChatSessionHistory sessions={SESSIONS} activeSessionId="aaaa1111" {...extra} {...props} />);
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

  it("FLF-244: phiên chính có nhãn và không có nút xoá; phiên phụ vẫn xoá được", () => {
    setup({ pipelineSessionId: "aaaa1111" });
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    const panel = screen.getByRole("dialog", { name: "Lịch sử phiên chat" });

    expect(within(panel).getByText("Phiên chính")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Xoá phiên #1111" })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Xoá phiên #2222" })).toBeInTheDocument();
  });

  it("FLF-244: createDisabled ⇒ nút Phiên mới bị khoá", () => {
    const { onCreateSession } = setup({ createDisabled: true });
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    const create = screen.getByRole("button", { name: "Phiên mới" });

    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(onCreateSession).not.toHaveBeenCalled();
  });
});

describe("ChatSessionHistory — Viewer (FLF-244)", () => {
  it("readOnly ⇒ không có Phiên mới, không có nút xoá; vẫn chọn xem phiên được", () => {
    const { onSelectSession } = setup({ readOnly: true });
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên chat" }));
    const panel = screen.getByRole("dialog", { name: "Lịch sử phiên chat" });

    expect(within(panel).queryByRole("button", { name: "Phiên mới" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Xoá phiên/ })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /Phiên #2222/ }));
    expect(onSelectSession).toHaveBeenCalledWith(SESSIONS[1]);
  });
});
