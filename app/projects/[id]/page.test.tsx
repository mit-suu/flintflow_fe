import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api/client";
import { signalProjectModeMaybeChanged } from "@/lib/project-mode-signal";
import WorkspacePage from "./page";

const P = MODE1_PROJECT_ID;
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: MODE1_PROJECT_ID }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/projects/${MODE1_PROJECT_ID}`,
}));
// Đã đăng nhập: AuthGuard/useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));

// jsdom không hiện thực scrollIntoView (ChatPane tự cuộn)
Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("WorkspacePage — project mode 1 (v3 bám BPMN)", () => {
  it("chưa import xong ⇒ chuyển sang wizard import", async () => {
    renderWithIntl(<WorkspacePage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/projects/${P}/import`));
  });

  it("mode 1 v3 (bám BPMN): import xong ⇒ không chạy step / ký v1 / waive; cột cờ có lối Tạo CR; sửa qua chat, không Hoàn tác / viết lại mục cũ", async () => {
    await importToGapReview();
    renderWithIntl(<WorkspacePage />);

    const tools = await screen.findByRole("complementary", { name: "Cờ, change request & version" });
    expect(router.replace).not.toHaveBeenCalled();
    const red = await within(tools).findByRole("region", { name: "Cờ đỏ đang chặn release" });
    expect(within(red).getByRole("link", { name: "Tạo CR" }).getAttribute("href")).toContain("source=gap_report");
    expect(within(tools).queryByRole("button", { name: "Ký baseline v1" })).not.toBeInTheDocument();
    expect(within(tools).queryByRole("button", { name: /Waive|Bật|Tắt/ })).not.toBeInTheDocument();
    expect(within(tools).getByRole("link", { name: "Gap report" })).toHaveAttribute("href", `/projects/${P}?panel=gap`);
    // Header: người sửa được có lối re-upload file đã sửa (UC-25)
    expect(screen.getByRole("link", { name: "Re-upload file đã sửa" })).toHaveAttribute("href", `/projects/${P}?panel=reupload`);
    expect(await within(tools).findByRole("button", { name: "Tải file gốc" })).toBeInTheDocument();
    // panel ghi Spine thẳng (tên riêng, hàng đợi màn) không có ở mode 1; không có nút chạy bước
    expect(within(tools).queryByText("Tên riêng & thuật ngữ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Chạy bước/ })).not.toBeInTheDocument();
    // tài liệu: không còn lối "xem tại step", tiêu đề chat không nói "Duyệt bước"
    expect(screen.queryByRole("button", { name: /^xem tại S-/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hỏi đáp & lệnh sửa" })).toBeInTheDocument();

    // Phase 8: chat bên trái mặc định là sửa tài liệu qua change request (chip bật sẵn); tắt chip ⇒ hỏi đáp.
    // Mode 1 không áp thẳng nên không có Hoàn tác / viết lại mục cũ
    expect(screen.queryByRole("complementary", { name: "Change panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa tài liệu" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByLabelText("Hướng dẫn sửa tài liệu")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Gõ yêu cầu sửa tài liệu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sửa tài liệu" }));
    expect(screen.queryByLabelText("Hướng dẫn sửa tài liệu")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Viết lại/ })).not.toBeInTheDocument();
  }, 30_000); // dựng cả workspace trên msw — chậm khi cả suite cùng chạy (hạn chờ findBy*/waitFor ở test/setup.ts) // dựng cả workspace trên msw — chậm khi cả suite cùng chạy (hạn chờ findBy*/waitFor ở test/setup.ts)
});

describe("WorkspacePage — FLF-318: Lead chốt baseline dự án tạo SRS", () => {
  it("dự án đổi sang mode import sau khi duyệt ⇒ không tải lại trang, workspace chuyển sang mode 1 kèm thông báo", async () => {
    await importToGapReview();
    // Lần đọc đầu: dự án còn là tạo SRS; sau khi duyệt BE trả mode import + converted_from
    let converted = false;
    let reads = 0;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId`, () => {
        reads += 1;
        return HttpResponse.json({
          data: converted
            ? { _id: P, name: "Lumen", status: "active", mode: "import", import_state: "delivered", converted_from: "fpt", createdAt: "", updatedAt: "" }
            : { _id: P, name: "Lumen", status: "active", mode: "fpt", import_state: null, createdAt: "", updatedAt: "" },
          meta: null,
          error: null,
        });
      })
    );
    renderWithIntl(<WorkspacePage />);
    await waitFor(() => expect(reads).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByLabelText("Đang tải không gian làm việc SRS")).not.toBeInTheDocument());
    expect(screen.queryByRole("complementary", { name: "Cờ, change request & version" })).not.toBeInTheDocument();

    converted = true;
    act(() => signalProjectModeMaybeChanged());
    expect(await screen.findByRole("complementary", { name: "Cờ, change request & version" })).toBeInTheDocument();
    expect(screen.getByText(/Baseline đã chốt — dự án chuyển sang chế độ quản lý thay đổi/)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  }, 30_000);
});

describe("WorkspacePage — FLF-318: thêm / xoá use case ở mode 1 đi vòng hỏi đáp như trước baseline", () => {
  it("lệnh 'thêm UC …' ⇒ gọi bản xem trước (không mở CR ngay); lệnh khác ⇒ mở CR như cũ", async () => {
    await importToGapReview();
    const previews: string[] = [];
    let crCreated = 0;
    mockServer.events.on("request:start", ({ request }) => {
      const path = new URL(request.url).pathname;
      if (request.method !== "POST") return;
      if (path.endsWith("/changes/preview")) previews.push(path);
      if (path.endsWith("/change-requests")) crCreated += 1;
    });
    renderWithIntl(<WorkspacePage />);
    const input = await screen.findByPlaceholderText(/Gõ yêu cầu sửa tài liệu/);
    fireEvent.change(input, { target: { value: "thêm UC phúc khảo điểm cho học sinh" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(previews.length).toBe(1));
    expect(crCreated).toBe(0);
    // Không hiện thẻ chọn người yêu cầu của CR — đang ở vòng hỏi đáp / bản xem trước
    expect(screen.queryByLabelText("Chọn người yêu cầu")).not.toBeInTheDocument();
    mockServer.events.removeAllListeners();
  }, 30_000);
});
