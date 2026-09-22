"use client";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateActionCost } from "@/lib/api/chat";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, mode1State, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import { useWorkspace } from "../hooks/useWorkspace";
import ChatPane from "./ChatPane";
import CrPrefillCard from "./mode1/CrPrefillCard";
import { readCrPrefill } from "./mode1/prefill";
import type { ChatSession } from "@/types/chat";

vi.mock("@/lib/api/chat", () => ({
  estimateActionCost: vi.fn().mockResolvedValue({ data: { actionType: "chat", cost: 1 }, error: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));
// Đã đăng nhập: useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));

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
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    expect(onEditInstruction).toHaveBeenCalledWith("Đổi tên actor A03 thành Administrator");
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("session.is_pipeline === true: gửi tin nhắn gọi onSendMessage như bình thường", () => {
    const { onEditInstruction, onSendMessage } = renderPane(withPipelineFlag(true));

    expect(screen.queryByText(/không phải phiên pipeline/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onEditInstruction).not.toHaveBeenCalled();
  });

  it("session không có is_pipeline (mặc định pipeline, không phá luồng chat cũ): gửi tin nhắn gọi onSendMessage", () => {
    const { onEditInstruction, onSendMessage } = renderPane(baseSession);

    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onEditInstruction).not.toHaveBeenCalled();
  });
});

describe("ChatPane — mode 1: 409 CHANGE_REQUIRES_CR ⇒ thẻ tạo change request (G9, BR-03)", () => {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
  beforeEach(async () => {
    resetMockState();
    resetMode1MockState();
    await importToGapReview();
  });
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());

  /** Nối ChatPane với useWorkspace thật (msw) như workspace project mode 1, bỏ phần tài liệu. */
  function Mode1Chat() {
    const ws = useWorkspace(MODE1_PROJECT_ID);
    return (
      <ChatPane
        title="Hỏi đáp về tài liệu"
        inputPlaceholder="Hỏi về nội dung tài liệu…"
        session={ws.activeSession}
        inputMessage={ws.inputMessage}
        setInputMessage={ws.setInputMessage}
        onSendMessage={(custom) => void ws.sendMessage(null, custom)}
        sending={ws.sending}
        pendingAttachments={ws.pendingAttachments}
        onSelectAttachment={ws.selectAttachment}
        onRemoveAttachment={ws.removeAttachment}
        streamingMessage={ws.streamingMessage}
        isStreaming={ws.streamingMessage !== null}
      >
        {ws.crPrefill && <CrPrefillCard projectId={MODE1_PROJECT_ID} prefill={ws.crPrefill} onDismiss={ws.dismissCrPrefill} />}
      </ChatPane>
    );
  }

  const send = async (text: string) => {
    const box = await screen.findByPlaceholderText("Hỏi về nội dung tài liệu…");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
  };

  it("FLF-186: lệnh sửa sau baseline ⇒ BE tạo CR nguồn chat, thẻ “Đã tạo CR-001” mở thẳng CR; không alert, tin nhắn tạm được gỡ", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const error = vi.spyOn(console, "error");
    renderWithIntl(<Mode1Chat />);
    expect(screen.getByRole("heading", { name: "Hỏi đáp về tài liệu" })).toBeInTheDocument();

    await send("Đổi tên actor Student thành Learner");
    const card = await screen.findByRole("status");
    expect(within(card).getByText("Đã tạo CR-001 từ lệnh sửa")).toBeInTheDocument();
    expect(within(card).getByText("Đổi tên actor Student thành Learner").tagName).toBe("BLOCKQUOTE");
    expect(within(card).getByRole("link", { name: "Mở CR-001" })).toHaveAttribute("href", `/projects/${MODE1_PROJECT_ID}/change-requests/CR-001`);
    expect(mode1State.crs.get("CR-001")?.change_request).toMatchObject({ source: { kind: "chat" }, description: "Đổi tên actor Student thành Learner" });

    // tin nhắn tạm (optimistic) bị gỡ, ô nhập đã xoá, không alert / console.error cho luồng bình thường này
    await waitFor(() => expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeInTheDocument());
    expect(screen.queryByText("Đổi tên actor Student thành Learner", { selector: ":not(blockquote)" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Hỏi về nội dung tài liệu…")).toHaveValue("");
    expect(alert).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalledWith("[Chat] Stream error:", expect.anything());
    alert.mockRestore();
    error.mockRestore();
  });

  it("Đóng ⇒ ẩn thẻ; gửi lệnh sửa khác ⇒ thẻ mới theo lệnh mới (CR mới)", async () => {
    renderWithIntl(<Mode1Chat />);
    await send("Thêm NFR thời gian phản hồi 2 giây");
    const card = await screen.findByRole("status");
    fireEvent.click(within(card).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await send("Sửa mô tả actor Guest");
    expect(await screen.findByText("Sửa mô tả actor Guest", { selector: "blockquote" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở CR-002" })).toBeInTheDocument();
    expect(screen.queryByText("Thêm NFR thời gian phản hồi 2 giây")).not.toBeInTheDocument();
  });

  it("BE không tạo được CR (chỉ prefill) ⇒ thẻ “Tạo change request” điền sẵn (nguồn verbal)", () => {
    renderWithIntl(<CrPrefillCard projectId={MODE1_PROJECT_ID} prefill={{ title: "Đổi tên actor", description: "Đổi tên actor Student" }} onDismiss={vi.fn()} />);
    const card = screen.getByRole("status");
    expect(within(card).getByText("Muốn sửa tài liệu? Hãy tạo change request")).toBeInTheDocument();
    const href = within(card).getByRole("link", { name: "Tạo change request" }).getAttribute("href")!;
    expect(href.startsWith(`/projects/${MODE1_PROJECT_ID}/change-requests?`)).toBe(true);
    expect(readCrPrefill(new URL(href, "http://x").searchParams)).toEqual({ title: "Đổi tên actor", description: "Đổi tên actor Student", source: "verbal", ref: undefined });
  });
});
