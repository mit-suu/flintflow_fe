/**
 * FLF-244 — phiên chat trong workspace: vào trang luôn mở phiên chính (không phải phiên mới nhất), danh sách chỉ có
 * tin cuối nên phiên mở phải tải đủ lịch sử, "Phiên mới" dùng lại phiên phụ còn trống, phiên chính không xoá được.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, MOCK_SESSION_ID, mockState, resetMockState } from "@/mocks/state";
import { useWorkspace } from "./useWorkspace";

// Đã đăng nhập: useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));
// Org đang mở (claim `orgId` của token) — mặc định không có, ca Viewer đặt riêng
const activeOrg = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/api/token-store", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveOrgId: () => activeOrg.id,
}));

const SECONDARY_ID = "650000000000000000000def";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

beforeEach(() => {
  activeOrg.id = null;
  resetMockState();
  const pipeline = mockState.sessions[0];
  pipeline.messages = [
    { role: "user", content: "Ý tưởng: đặt lịch cắt tóc", step: "B-0.1", createdAt: "2026-10-01T00:00:00Z" },
    { role: "ai", content: "Đã ghi nhận", step: "B-0.1", createdAt: "2026-10-01T00:00:01Z" },
  ];
  // Phiên phụ tạo SAU phiên chính ⇒ đứng đầu danh sách (mới nhất trước)
  mockState.sessions = [{ _id: SECONDARY_ID, projectId: MOCK_PROJECT_ID, messages: [], createdAt: "2026-10-02T00:00:00Z" }, pipeline];
});

const mount = async () => {
  const hook = renderHook(() => useWorkspace(MOCK_PROJECT_ID));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
};

describe("useWorkspace — phiên chính và phiên phụ (FLF-244)", () => {
  it("vào workspace mở phiên chính kèm đủ lịch sử, dù phiên phụ mới hơn", async () => {
    const { result } = await mount();

    expect(result.current.activeSession?._id).toBe(MOCK_SESSION_ID);
    expect(result.current.activeSession?.messages).toHaveLength(2);
    expect(result.current.pipelineSession?._id).toBe(MOCK_SESSION_ID);
    expect(result.current.isPipelineActive).toBe(true);
  });

  it("Phiên mới khi đã có phiên phụ trống ⇒ mở lại phiên đó, không tạo thêm", async () => {
    const posted = vi.fn();
    mockServer.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/chats")) posted();
    });
    const { result } = await mount();

    await act(() => result.current.createSession());

    expect(posted).not.toHaveBeenCalled();
    expect(result.current.activeSession?._id).toBe(SECONDARY_ID);
    expect(result.current.isPipelineActive).toBe(false);
    expect(result.current.sessions).toHaveLength(2);
    mockServer.events.removeAllListeners();
  });

  it("xoá phiên chính ⇒ BE 409, phiên vẫn còn, lỗi hiện qua notice (không alert)", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = await mount();

    await act(() => result.current.deleteSession(MOCK_SESSION_ID));

    expect(result.current.sessions.map((s) => s._id)).toContain(MOCK_SESSION_ID);
    expect(result.current.notice).toMatchObject({ key: "deleteFailed" });
    expect(alertSpy).not.toHaveBeenCalled();
    act(() => result.current.clearNotice());
    expect(result.current.notice).toBeNull();
    alertSpy.mockRestore();
  });

  it("chưa có phiên nào và Viewer không được tạo (403) ⇒ im lặng, không báo lỗi", async () => {
    mockState.sessions = [];
    mockServer.use(
      http.post("*/projects/:projectId/chats", () =>
        Response.json({ data: null, error: { code: "ORG_ROLE_FORBIDDEN", message: "forbidden" } }, { status: 403 })
      )
    );
    const { result } = await mount();

    expect(result.current.activeSession).toBeNull();
    expect(result.current.notice).toBeNull();
  });
});

describe("useWorkspace — vai trò trong org (FLF-244)", () => {
  const orgHandler = (role: string) =>
    http.get("*/orgs/:orgId", ({ params }) =>
      Response.json({ data: { id: params.orgId, name: "Nhóm A", role, memberCount: 2 }, error: null })
    );

  it("Viewer ⇒ canEdit = false", async () => {
    activeOrg.id = "org-a";
    mockServer.use(orgHandler("viewer"));
    const { result } = await mount();

    await waitFor(() => expect(result.current.canEdit).toBe(false));
  });

  it("Analyst ⇒ canEdit = true; không có org trong token ⇒ không gọi /orgs, vẫn canEdit", async () => {
    activeOrg.id = "org-a";
    mockServer.use(orgHandler("analyst"));
    const analyst = await mount();
    await waitFor(() => expect(analyst.result.current.canEdit).toBe(true));
    analyst.unmount();

    activeOrg.id = null;
    const none = await mount();
    expect(none.result.current.canEdit).toBe(true);
  });
});

describe("useWorkspace — replaceProject (FLF-265 §3.7)", () => {
  it("thay project bằng bản BE vừa trả ⇒ ngôn ngữ tài liệu mới có ngay, không tải lại workspace", async () => {
    const { result } = await mount();
    expect(result.current.project?.documentLanguage).not.toBe("vi");

    act(() => result.current.replaceProject({ ...result.current.project!, documentLanguage: "vi" }));
    expect(result.current.project?.documentLanguage).toBe("vi");
  });
});

/**
 * FLF-279 — lượt hỏi tri thức. Hai nhánh hỏng dễ im lặng: máy chủ tắt tính năng (409), và lỗi giữa luồng
 * (`streamSse` phát `error` mà KHÔNG ném, nên `catch` không chạy). Luồng này không stream chữ, nên im
 * lặng nghĩa là user chỉ thấy spinner tắt đi.
 */
describe("useWorkspace — lượt hỏi tri thức (FLF-279)", () => {
  const ask = async (result: { current: ReturnType<typeof useWorkspace> }) => {
    await act(async () => {
      await result.current.sendMessage("chat", "Trần lượt gọi model là bao nhiêu?", { knowledge: true });
    });
  };

  it("409 KNOWLEDGE_DISABLED ⇒ ẩn chip, báo lý do, trả chữ về ô nhập, không để tin ma", async () => {
    mockState.knowledgeDisabled = true;
    const { result } = await mount();
    const before = result.current.activeSession!.messages.length;

    await ask(result);

    expect(result.current.knowledgeDisabled).toBe(true);
    expect(result.current.notice).toEqual({ key: "knowledgeDisabled" });
    expect(result.current.inputMessage).toBe("Trần lượt gọi model là bao nhiêu?");
    expect(result.current.activeSession!.messages).toHaveLength(before);
    expect(result.current.knowledgePending).toBe(false);
  });

  it("lỗi giữa luồng ⇒ có thông báo, gỡ tin tạm, trả chữ về ô nhập (không kết thúc im lặng)", async () => {
    mockServer.use(
      http.post(`*/projects/${MOCK_PROJECT_ID}/chats/${MOCK_SESSION_ID}/messages/stream`, () => {
        const body = `data: ${JSON.stringify({ type: "error", error: "Ví credit không đủ" })}\n\n`;
        return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
      })
    );
    const { result } = await mount();
    const before = result.current.activeSession!.messages.length;

    await ask(result);

    expect(result.current.notice).toBeTruthy();
    expect(result.current.activeSession!.messages).toHaveLength(before);
    expect(result.current.inputMessage).toBe("Trần lượt gọi model là bao nhiêu?");
    expect(result.current.knowledgePending).toBe(false);
  });

  it("lượt tri thức thành công ⇒ tin AI vào phiên, không còn chờ", async () => {
    const { result } = await mount();

    await ask(result);

    const last = result.current.activeSession!.messages.at(-1)!;
    expect(last.role).toBe("ai");
    expect(JSON.parse(last.content).grounded).toBe(true);
    expect(result.current.knowledgePending).toBe(false);
    expect(result.current.knowledgeDisabled).toBe(false);
  });
});

describe("useWorkspace — dừng lượt chat (stopMessage)", () => {
  it("dừng giữa stream ⇒ huỷ fetch, bỏ chữ dở, giữ tin user, báo đã dừng, hết trạng thái gửi", async () => {
    let aborted = false;
    mockServer.use(
      http.post(`*/projects/${MOCK_PROJECT_ID}/chats/${MOCK_SESSION_ID}/messages/stream`, ({ request }) => {
        request.signal.addEventListener("abort", () => {
          aborted = true;
        });
        // Phát một mẩu chữ rồi treo — như model đang sinh dở
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "text-delta", delta: "Đang tr" })}\n\n`));
          },
        });
        return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
      })
    );
    const { result } = await mount();
    const before = result.current.activeSession!.messages.length;

    let sent!: Promise<unknown>;
    act(() => {
      sent = result.current.sendMessage("chat", "Giải thích luồng đặt lịch");
    });
    await waitFor(() => expect(result.current.streamingMessage).toBe("Đang tr"));
    expect(result.current.sending).toBe(true);

    await act(async () => {
      result.current.stopMessage();
      await sent;
    });

    expect(aborted).toBe(true);
    expect(result.current.streamingMessage).toBeNull();
    expect(result.current.sending).toBe(false);
    expect(result.current.notice).toEqual({ key: "stopped" });
    const messages = result.current.activeSession!.messages;
    expect(messages).toHaveLength(before + 1);
    expect(messages.at(-1)).toMatchObject({ role: "user", content: "Giải thích luồng đặt lịch" });
  });
});
