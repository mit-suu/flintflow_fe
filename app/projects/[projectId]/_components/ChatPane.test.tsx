"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateActionCost } from "@/lib/api/chat";
import ChatPane from "./ChatPane";
import type { ChatSession } from "@/types/chat";

vi.mock("@/lib/api/chat", () => ({
  estimateActionCost: vi.fn().mockResolvedValue({ data: { actionType: "chat", cost: 1 }, error: null }),
}));

// jsdom không hiện thực `scrollIntoView` — ChatPane tự cuộn xuống tin nhắn cuối khi mount.
Element.prototype.scrollIntoView = vi.fn();

const baseSession: ChatSession = {
  _id: "s1",
  projectId: "p1",
  messages: [],
  isActive: true,
  createdAt: "2026-09-15T00:00:00.000Z",
};

/** `is_pipeline` không có trong `types/chat.ts` (T07, R với T16) — mở rộng cục bộ như `ChatPane.tsx`. */
const withPipelineFlag = (isPipeline: boolean): ChatSession => ({ ...baseSession, is_pipeline: isPipeline }) as ChatSession;

const renderPane = (session: ChatSession, onEditInstruction = vi.fn(), onSendMessage = vi.fn()) => {
  renderWithIntl(
    <ChatPane
      session={session}
      inputMessage="Đổi tên actor A03 thành Administrator"
      setInputMessage={() => {}}
      onSendMessage={onSendMessage}
      sending={false}
      pendingAttachments={[]}
      onSelectAttachment={() => {}}
      onRemoveAttachment={() => {}}
      onEditInstruction={onEditInstruction}
    />
  );
  return { onEditInstruction, onSendMessage };
};

describe("ChatPane — forward lệnh sửa vào Change panel (session không pipeline)", () => {
  beforeEach(() => {
    vi.mocked(estimateActionCost).mockClear();
  });

  it("session.is_pipeline === false: gửi lệnh gọi onEditInstruction, không gọi onSendMessage", () => {
    const { onEditInstruction, onSendMessage } = renderPane(withPipelineFlag(false));

    expect(screen.getByText(/không phải phiên pipeline/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "arrow_upward" }));

    expect(onEditInstruction).toHaveBeenCalledWith("Đổi tên actor A03 thành Administrator");
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("session.is_pipeline === true: gửi tin nhắn gọi onSendMessage như bình thường", () => {
    const { onEditInstruction, onSendMessage } = renderPane(withPipelineFlag(true));

    expect(screen.queryByText(/không phải phiên pipeline/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "arrow_upward" }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onEditInstruction).not.toHaveBeenCalled();
  });

  it("session không có is_pipeline (mặc định pipeline, không phá luồng chat cũ): gửi tin nhắn gọi onSendMessage", () => {
    const { onEditInstruction, onSendMessage } = renderPane(baseSession);

    fireEvent.click(screen.getByRole("button", { name: "arrow_upward" }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onEditInstruction).not.toHaveBeenCalled();
  });
});
