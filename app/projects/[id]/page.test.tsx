import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import WorkspacePage from "./page";

const P = MODE1_PROJECT_ID;
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: MODE1_PROJECT_ID }),
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
    expect(within(tools).getByRole("link", { name: "Gap report" })).toHaveAttribute("href", `/projects/${P}/gap-report`);
    expect(await within(tools).findByRole("button", { name: "Tải file gốc" })).toBeInTheDocument();
    // panel ghi Spine thẳng (tên riêng, hàng đợi màn) không có ở mode 1; không có nút chạy bước
    expect(within(tools).queryByText("Tên riêng & thuật ngữ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Chạy bước/ })).not.toBeInTheDocument();
    // tài liệu: không còn lối "xem tại step", tiêu đề chat không nói "Duyệt bước"
    expect(screen.queryByRole("button", { name: /^xem tại S-/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hỏi đáp & lệnh sửa" })).toBeInTheDocument();

    // Sửa tài liệu đi qua ô chat (chip "Sửa tài liệu"); mode 1 không áp thẳng nên không có Hoàn tác / viết lại mục cũ
    expect(screen.queryByRole("complementary", { name: "Change panel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sửa tài liệu" }));
    expect(screen.getByPlaceholderText(/Mô tả chỗ cần sửa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Viết lại/ })).not.toBeInTheDocument();
  }, 30_000); // dựng cả workspace trên msw — chậm khi cả suite cùng chạy (hạn chờ findBy*/waitFor ở test/setup.ts) // dựng cả workspace trên msw — chậm khi cả suite cùng chạy (hạn chờ findBy*/waitFor ở test/setup.ts)
});
