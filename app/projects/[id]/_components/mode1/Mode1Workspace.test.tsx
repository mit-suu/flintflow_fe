import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import Mode1Workspace from "./Mode1Workspace";
import { readCrPrefill } from "./prefill";

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

describe("Mode1Workspace", () => {
  it("chưa import xong ⇒ chuyển sang wizard import", async () => {
    render(<Mode1Workspace projectId={P} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/projects/${P}/import`));
  });

  it("đã có baseline: hiện tài liệu 0.0 + version; lệnh sửa trong chat ⇒ thẻ tạo CR điền sẵn (BR-03)", async () => {
    await importToGapReview();
    render(<Mode1Workspace projectId={P} />);

    expect(await screen.findByText("1 Product Overview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem bản 0.0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled(); // mock còn 1 cờ đỏ

    fireEvent.change(document.querySelector("textarea")!, {
      target: { value: "Đổi tên actor Student thành Learner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "arrow_upward" }));

    expect(await screen.findByText("Muốn sửa tài liệu? Hãy tạo change request")).toBeInTheDocument();
    const href = screen.getByRole("link", { name: "Tạo change request" }).getAttribute("href")!;
    expect(readCrPrefill(new URL(href, "http://x").searchParams)).toMatchObject({
      source: "verbal",
      description: "Đổi tên actor Student thành Learner",
    });
  });
});
