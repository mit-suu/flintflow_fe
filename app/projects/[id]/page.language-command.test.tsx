/**
 * FLF-265 §3.7 (D15) — lệnh đổi ngôn ngữ tài liệu gõ trong chat bị chặn TRƯỚC khi gửi: không chạy bước, không hỏi đáp, không
 * thành lệnh sửa. Thẻ xác nhận trong chat ⇒ "Đồng ý" đổi ngôn ngữ (rồi mở hộp dịch nếu còn mục thiếu) · "Không, gửi như tin
 * nhắn" gửi đúng như trước. Mode 1 ⇒ thẻ D3; Viewer ⇒ không có ô chat, không có thẻ.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockTiming, resetMockChangeFlowState, resetMockTranslationState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, mockState, resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import WorkspacePage from "./page";

const { router, nav, activeOrg } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  nav: { id: "" },
  activeOrg: { id: null as string | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: nav.id }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/projects/${nav.id}`,
}));
// Đã đăng nhập: AuthGuard/useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));
// Org đang mở — mặc định không có (coi như được sửa), ca Viewer đặt riêng
vi.mock("@/lib/api/token-store", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveOrgId: () => activeOrg.id,
}));

// jsdom không hiện thực scrollIntoView (ChatPane tự cuộn)
Element.prototype.scrollIntoView = vi.fn();

/** Mọi request ghi đi ra (method + path) và body — để khẳng định lệnh không tới step runner / chat / changes. */
let writes: { method: string; path: string; body: string }[] = [];

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  nav.id = MOCK_PROJECT_ID;
  activeOrg.id = null;
  resetMockState();
  resetMode1MockState();
  resetMockChangeFlowState();
  resetMockTranslationState();
  writes = [];
  mockServer.events.on("request:start", async ({ request }) => {
    if (request.method === "GET") return;
    const body = await request.clone().text().catch(() => "");
    writes.push({ method: request.method, path: new URL(request.url).pathname, body });
  });
  // Khôi phục lượt chạy lúc vào workspace (BUG-07) hỏi lượt đang sống — mock chung chưa có route này: không có lượt nào
  mockServer.use(
    http.get("*/projects/:projectId/run-state/active", () => HttpResponse.json({ data: null, error: null })),
    // Chạy cả giai đoạn (tin gửi bình thường ở bước tới lượt) — mock chung chưa có; ở đây chỉ cần biết câu đã tới đây
    http.post("*/projects/:projectId/phases/:phase/run", () =>
      HttpResponse.json({ data: null, error: { code: "STEP_NOT_RUNNABLE", message: "Bước chưa chạy được" } }, { status: 409 })
    )
  );
});
afterEach(() => {
  mockServer.events.removeAllListeners();
  mockServer.resetHandlers();
});
afterAll(() => mockServer.close());

const chatInput = async () => {
  await waitFor(() => expect(document.getElementById("flintflow-chat-input")).not.toBeNull());
  return document.getElementById("flintflow-chat-input") as HTMLTextAreaElement;
};

const type = async (text: string) => {
  const input = await chatInput();
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
};

/** Lượt gửi tới AI: chạy bước, trả lời, cổng, chat hỏi đáp, lệnh sửa. */
const aiWrites = () => writes.filter((w) => /\/steps\/|\/phases\/|\/messages\/stream|\/changes|\/change-requests/.test(w.path));

describe("WorkspacePage — lệnh đổi ngôn ngữ tài liệu trong chat (FLF-265 §3.7)", () => {
  it("dự án en: lệnh dịch sang tiếng Việt ⇒ thẻ xác nhận, không gửi cho AI; Đồng ý ⇒ PATCH ngôn ngữ, chip đổi, mở hộp dịch", async () => {
    renderWithIntl(<WorkspacePage />);
    expect(await screen.findByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("EN");

    await type("Dịch tài liệu sang tiếng Việt nhé");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    expect(within(card).getByText("Đổi tài liệu sang tiếng Việt?")).toBeInTheDocument();
    expect((await chatInput()).value).toBe("");
    expect(aiWrites()).toEqual([]);

    fireEvent.click(within(card).getByRole("button", { name: "Đồng ý" }));
    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    // Ước tính vừa đọc truyền vào hộp ⇒ hiện ngay, chờ user xác nhận credit
    expect(await within(dialog).findByRole("button", { name: "Dịch ngay" })).toBeInTheDocument();
    expect(writes.filter((w) => w.path.endsWith("/document-language"))).toEqual([
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ documentLanguage: "vi" }) }),
    ]);
    expect(mockState.project.documentLanguage).toBe("vi");
    await waitFor(() => expect(screen.getByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("VI"));
    expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull();
    expect(aiWrites()).toEqual([]);
  }, 30_000); // dựng cả workspace trên msw — chậm khi cả suite cùng chạy

  it("dự án vi: lệnh về tiếng Anh (ngôn ngữ gốc) ⇒ Đồng ý chỉ đổi, không mở hộp dịch", async () => {
    mockState.project.documentLanguage = "vi";
    renderWithIntl(<WorkspacePage />);
    expect(await screen.findByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("VI");

    await type("translate the document to English");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    expect(within(card).getByText(/không cần dịch, không tốn credit/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Đồng ý" }));

    await waitFor(() => expect(screen.getByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("EN"));
    expect(mockState.project.documentLanguage).toBe("en");
    expect(screen.queryByRole("dialog", { name: "Dịch tài liệu" })).toBeNull();
    expect(aiWrites()).toEqual([]);
  }, 30_000);

  it("Không, gửi như tin nhắn ⇒ gửi đúng câu đó qua đường cũ (chạy bước), không đổi ngôn ngữ", async () => {
    renderWithIntl(<WorkspacePage />);
    await screen.findByTitle(/^Ngôn ngữ tài liệu/);

    await type("dịch sang tiếng Việt");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    fireEvent.click(within(card).getByRole("button", { name: "Không, gửi như tin nhắn" }));

    await waitFor(() => expect(aiWrites().length).toBeGreaterThan(0));
    expect(aiWrites()[0].body).toContain("dịch sang tiếng Việt");
    expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull();
    expect(writes.some((w) => w.path.endsWith("/document-language"))).toBe(false);
  }, 30_000);

  it("chip Sửa tài liệu bật: lệnh dịch không thành lệnh sửa (/changes/preview); đóng thẻ ⇒ câu về lại ô chat", async () => {
    renderWithIntl(<WorkspacePage />);
    await screen.findByTitle(/^Ngôn ngữ tài liệu/);
    fireEvent.click(screen.getByRole("button", { name: "Sửa tài liệu" }));

    await type("đổi ngôn ngữ tài liệu sang tiếng Việt");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    expect(aiWrites()).toEqual([]);
    expect(screen.queryByRole("status", { name: "Sửa tài liệu" })).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Đóng thẻ ngôn ngữ" }));
    expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull();
    await waitFor(async () => expect((await chatInput()).value).toBe("đổi ngôn ngữ tài liệu sang tiếng Việt"));
    expect(aiWrites()).toEqual([]);
  }, 30_000);

  it("đã đúng ngôn ngữ, còn mục chưa dịch ⇒ thẻ mời dịch nốt, không gửi cho AI", async () => {
    mockState.project.documentLanguage = "vi";
    renderWithIntl(<WorkspacePage />);
    await screen.findByTitle(/^Ngôn ngữ tài liệu/);

    await type("dịch sang tiếng Việt");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    expect(within(card).getByText("Tài liệu đang là tiếng Việt")).toBeInTheDocument();
    fireEvent.click(await within(card).findByRole("button", { name: "Dịch 100 mục còn thiếu" }));

    expect(await screen.findByRole("dialog", { name: "Dịch tài liệu" })).toBeInTheDocument();
    expect(writes.some((w) => w.path.endsWith("/document-language"))).toBe(false);
    expect(aiWrites()).toEqual([]);
  }, 30_000);

  it("câu chỉ nhắc tới ngôn ngữ ⇒ gửi bình thường, không có thẻ", async () => {
    renderWithIntl(<WorkspacePage />);
    await screen.findByTitle(/^Ngôn ngữ tài liệu/);

    await type("tên màn hình bằng tiếng Anh nhé");
    await waitFor(() => expect(aiWrites().length).toBeGreaterThan(0));
    expect(aiWrites()[0].body).toContain("tên màn hình bằng tiếng Anh nhé");
    expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull();
  }, 30_000);

  it("Viewer: không có ô chat ⇒ không có thẻ, không đổi được gì", async () => {
    activeOrg.id = "org-a";
    mockServer.use(
      http.get("*/orgs/:orgId", ({ params }) => HttpResponse.json({ data: { id: params.orgId, name: "Nhóm A", role: "viewer", memberCount: 2 }, error: null }))
    );
    renderWithIntl(<WorkspacePage />);

    expect(await screen.findByText(/vai trò Viewer/)).toBeInTheDocument();
    expect(document.getElementById("flintflow-chat-input")).toBeNull();
    expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull();
  }, 30_000);
});

describe("WorkspacePage mode 1 — lệnh đổi ngôn ngữ (D3)", () => {
  it("dự án upload: thẻ báo giữ ngôn ngữ file, không đổi; Gửi như tin nhắn ⇒ câu đi vào luồng CR như cũ", async () => {
    nav.id = MODE1_PROJECT_ID;
    await importToGapReview();
    writes = [];
    renderWithIntl(<WorkspacePage />);
    await screen.findByRole("complementary", { name: "Cờ, change request & version" });

    await type("dịch tài liệu sang tiếng Anh");
    const card = await screen.findByRole("status", { name: "Ngôn ngữ tài liệu" });
    expect(within(card).getByText("Dự án upload giữ ngôn ngữ của file tải lên")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Đồng ý" })).toBeNull();
    // Chưa đi đâu: chưa có bong bóng user nào mang câu này (thẻ chỉ trích lại trong "Bạn gõ: …")
    expect(screen.queryByText("dịch tài liệu sang tiếng Anh")).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Gửi như tin nhắn" }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Ngôn ngữ tài liệu" })).toBeNull());
    // Chip sửa của mode 1 bật sẵn ⇒ câu thành yêu cầu CR đang chờ (bong bóng user trong luồng CR)
    expect(await screen.findByText("dịch tài liệu sang tiếng Anh")).toBeInTheDocument();
    expect(writes.some((w) => w.path.endsWith("/document-language"))).toBe(false);
  }, 30_000);
});
