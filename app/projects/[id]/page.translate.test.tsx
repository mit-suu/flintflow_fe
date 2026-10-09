import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockTiming, mockTranslation, resetMockChangeFlowState, resetMockTranslationState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, mockState, resetMockState } from "@/mocks/state";
import WorkspacePage from "./page";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: MOCK_PROJECT_ID }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/projects/${MOCK_PROJECT_ID}`,
}));
// Đã đăng nhập: AuthGuard/useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));

// jsdom không hiện thực scrollIntoView (ChatPane tự cuộn)
Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
  resetMockTranslationState();
  // Khôi phục lượt chạy lúc vào workspace (BUG-07) hỏi lượt đang sống — mock chung chưa có route này: không có lượt nào
  mockServer.use(http.get("*/projects/:projectId/run-state/active", () => HttpResponse.json({ data: null, error: null })));
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("WorkspacePage — dịch tài liệu (FLF-265)", () => {
  it("dự án vi còn mục chưa dịch: chip + cảnh báo trên tài liệu ⇒ hộp Dịch tài liệu ⇒ dịch xong tài liệu tự tải lại", async () => {
    mockState.project.documentLanguage = "vi";
    renderWithIntl(<WorkspacePage />);

    const warning = await screen.findByText("100 mục chưa dịch");
    expect(screen.getByTitle("Ngôn ngữ tài liệu")).toHaveTextContent("Tiếng Việt");
    fireEvent.click(within(warning.parentElement as HTMLElement).getByRole("button", { name: "Dịch tài liệu" }));

    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Dịch ngay" }));
    expect(await within(dialog).findByText("Đã dịch xong 100 mục.")).toBeInTheDocument();
    expect(mockTranslation.missing).toBe(0);

    // Bản dịch không đổi `spine_version` ⇒ trang tự tải lại tài liệu qua `onDone`: cảnh báo biến mất, chip giữ nguyên
    await waitFor(() => expect(screen.queryByText(/mục chưa dịch/)).toBeNull());
    expect(screen.getByTitle("Ngôn ngữ tài liệu")).toHaveTextContent("Tiếng Việt");
  }, 30_000); // dựng cả workspace trên msw — chậm khi cả suite cùng chạy

  it("dự án en (ngôn ngữ gốc): chip English, không cảnh báo, không có lối dịch", async () => {
    renderWithIntl(<WorkspacePage />);

    expect(await screen.findByTitle("Ngôn ngữ tài liệu")).toHaveTextContent("English");
    await screen.findByText(/1\. Product Overview/);
    expect(screen.queryByText(/mục chưa dịch/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Dịch tài liệu" })).toBeNull();
  }, 30_000);
});
