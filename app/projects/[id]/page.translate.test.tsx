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
    expect(screen.getByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("VI");
    fireEvent.click(within(warning.parentElement as HTMLElement).getByRole("button", { name: "Dịch tài liệu" }));

    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Dịch ngay" }));
    expect(await within(dialog).findByText("Đã dịch xong 100 mục.")).toBeInTheDocument();
    expect(mockTranslation.missing).toBe(0);

    // Bản dịch không đổi `spine_version` ⇒ trang tự tải lại tài liệu qua `onDone`: cảnh báo biến mất, chip giữ nguyên
    await waitFor(() => expect(screen.queryByText(/mục chưa dịch/)).toBeNull());
    expect(screen.getByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("VI");
  }, 30_000); // dựng cả workspace trên msw — chậm khi cả suite cùng chạy

  it("dự án en (ngôn ngữ gốc): chip English, không cảnh báo, không có lối dịch", async () => {
    renderWithIntl(<WorkspacePage />);

    expect(await screen.findByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("EN");
    await screen.findByText(/1\. Product Overview/);
    expect(screen.queryByText(/mục chưa dịch/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Dịch tài liệu" })).toBeNull();
  }, 30_000);
});

describe("WorkspacePage — tải theo ngôn ngữ còn lại (FLF-334 B)", () => {
  it("dự án en: Export chọn Tiếng Việt ⇒ 409 TRANSLATION_INCOMPLETE ⇒ “Dịch nốt” mở hộp dịch với ?locale=vi", async () => {
    const exportUrls: string[] = [];
    const statusUrls: string[] = [];
    mockServer.use(
      http.get("*/projects/:projectId/export/word", ({ request }) => {
        exportUrls.push(new URL(request.url).search);
        return HttpResponse.json(
          { data: null, error: { code: "TRANSLATION_INCOMPLETE", message: "thiếu" }, meta: { locale: "vi", missing: 5, total: 40 } },
          { status: 409 }
        );
      }),
      http.get("*/projects/:projectId/translations/status", ({ request }) => {
        statusUrls.push(new URL(request.url).search);
        return HttpResponse.json({ data: { locale: "vi", source_locale: "en", total: 40, missing: 5, batches: 1, estimated_credits: 2 }, error: null });
      })
    );
    renderWithIntl(<WorkspacePage />);

    expect(await screen.findByTitle(/^Ngôn ngữ tài liệu/)).toHaveTextContent("EN");
    fireEvent.click(screen.getByTitle("Hoàn tất và xuất tài liệu SRS"));
    const group = await screen.findByRole("radiogroup", { name: "Ngôn ngữ file" });
    fireEvent.click(within(group).getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản nháp/ }));

    const alert = await screen.findByText("Còn 5 mục chưa dịch sang Tiếng Việt nên chưa tải được bản này.");
    expect(exportUrls).toEqual(["?source=draft&lang=vi"]);
    fireEvent.click(within(alert.parentElement as HTMLElement).getByRole("button", { name: "Dịch nốt" }));

    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    await within(dialog).findByRole("button", { name: "Dịch ngay" });
    expect(statusUrls).toContain("?locale=vi");
  }, 30_000);
});

describe("WorkspacePage — dự án chuyển từ mode 2 tải version theo ngôn ngữ còn lại (FLF-334 B)", () => {
  it("1.0 other_language_available ⇒ “Tải bản Tiếng Việt” 409 ⇒ “Dịch nốt” mở hộp dịch với ?locale=vi&version=1.0", async () => {
    Object.assign(mockState.project, { mode: "import", import_state: "delivered", converted_from: "fpt", documentLanguage: "en" });
    const statusUrls: string[] = [];
    const downloadUrls: string[] = [];
    mockServer.use(
      http.get("*/projects/:projectId/versions", () =>
        HttpResponse.json({
          data: [
            {
              version: "1.0",
              kind: "imported",
              based_on: null,
              cr_ids: [],
              baseline_id: "BL001",
              has_clean_file: true,
              has_tracked_file: false,
              has_original_file: false,
              other_language_available: true,
              created_by: "u1",
              created_at: "2026-10-29T00:00:00.000Z",
            },
          ],
          error: null,
        })
      ),
      http.get("*/projects/:projectId/versions/:v/download", ({ request }) => {
        downloadUrls.push(new URL(request.url).search);
        return HttpResponse.json(
          { data: null, error: { code: "TRANSLATION_INCOMPLETE", message: "thiếu" }, meta: { locale: "vi", missing: 4, total: 40 } },
          { status: 409 }
        );
      }),
      http.get("*/projects/:projectId/translations/status", ({ request }) => {
        statusUrls.push(new URL(request.url).search);
        return HttpResponse.json({ data: { locale: "vi", source_locale: "en", total: 40, missing: 4, batches: 1, estimated_credits: 2 }, error: null });
      })
    );
    renderWithIntl(<WorkspacePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Tải bản Tiếng Việt" }));
    const alert = await screen.findByText("Còn 4 mục chưa dịch sang Tiếng Việt nên chưa tải được bản này.");
    expect(downloadUrls).toEqual(["?variant=auto&lang=vi"]);
    fireEvent.click(within(alert.parentElement as HTMLElement).getByRole("button", { name: "Dịch nốt" }));

    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    await within(dialog).findByRole("button", { name: "Dịch ngay" });
    expect(statusUrls).toContain("?locale=vi&version=1.0");
  }, 30_000);
});
