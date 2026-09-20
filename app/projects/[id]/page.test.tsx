import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, mode1State, resetMode1MockState } from "@/mocks/mode1/state";
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

describe("WorkspacePage — project mode 1 v2 (FLF-185)", () => {
  it("chưa import xong ⇒ chuyển sang wizard import", async () => {
    renderWithIntl(<WorkspacePage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/projects/${P}/import`));
  });

  it("import xong ⇒ workspace như mode 2 + cột kế hoạch step: đầu mục FPT thiếu, bật step ẩn, version (tải file gốc)", async () => {
    await importToGapReview();
    renderWithIntl(<WorkspacePage />);

    const tools = await screen.findByRole("complementary", { name: "Công cụ" }, { timeout: 5000 });
    expect(router.replace).not.toHaveBeenCalled();
    const missing = await within(tools).findByRole("region", { name: "Đầu mục FPT còn thiếu" });
    expect(within(missing).getByText(/S-7\.1/)).toBeInTheDocument();
    expect(within(tools).getByRole("button", { name: "Ký baseline v1" })).toBeDisabled(); // mock còn 1 cờ đỏ
    expect(within(tools).getByRole("link", { name: "Gap report" })).toHaveAttribute("href", `/projects/${P}/gap-report`);
    expect(await within(tools).findByRole("button", { name: "Tải file gốc" })).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole("button", { name: "Bật" }));
    await waitFor(() => expect(mode1State.stepPlan.find((s) => s.step_id === "B-0.1")?.state).toBe("enabled"));
    expect(await within(tools).findByRole("button", { name: "Tắt" })).toBeInTheDocument();
  }, 20_000); // dựng cả workspace trên msw — chậm khi chạy cùng cả suite
});
