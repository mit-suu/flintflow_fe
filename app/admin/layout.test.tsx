import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthGuard from "@/components/AuthGuard";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import AdminLayout from "./layout";

/*
 * Admin chỉ tiếng Việt (T25). `AuthGuard` dùng chung đã được dịch; layout admin phải ghim provider về `vi`
 * để cookie `en` không lọt vào admin. Giữ AuthGuard ở trạng thái "đang kiểm tra" (refresh không bao giờ xong).
 *
 * Nhãn "đang kiểm tra" giờ là `aria-label` của khối giữ chỗ và chỉ hiện sau `SKELETON_DELAY_MS`
 * (`components/AuthGuard.tsx`) — đường nhanh không được chớp gì — nên phải `findBy*` chứ không `getBy*`.
 */

vi.mock("next-intl/server", () => ({ getMessages: vi.fn(async () => MESSAGES.vi) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getUserRole: () => "admin", clearAuthToken: vi.fn() }));
vi.mock("@/lib/api", () => ({ refreshSession: () => new Promise(() => {}) }));

describe("app/admin/layout — chỉ tiếng Việt", () => {
  it("cookie en: trong admin vẫn là tiếng Việt", async () => {
    renderWithIntl(await AdminLayout({ children: <p>trang admin</p> }), "en");
    expect(await screen.findByRole("status", { name: "Đang kiểm tra quyền truy cập..." })).toBeInTheDocument();
  });

  it("khối admin tự khai lang=vi — <html lang> theo cookie nên có thể là en", async () => {
    renderWithIntl(await AdminLayout({ children: <p>trang admin</p> }), "en");
    const block = await screen.findByRole("status", { name: "Đang kiểm tra quyền truy cập..." });
    expect(block.closest("[lang]")).toHaveAttribute("lang", "vi");
  });

  it("đối chứng: cùng AuthGuard ngoài admin thì theo ngôn ngữ người dùng", async () => {
    renderWithIntl(<AuthGuard>nội dung</AuthGuard>, "en");
    expect(await screen.findByRole("status", { name: "Checking access..." })).toBeInTheDocument();
  });
});
