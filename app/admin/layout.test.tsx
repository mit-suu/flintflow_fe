import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import AdminLayout from "./layout";

/*
 * Admin song ngữ (FLF-328): layout không ghim locale nữa — chữ trong admin theo provider của root layout
 * (cookie `NEXT_LOCALE`). Giữ AuthGuard ở trạng thái "đang kiểm tra" (refresh không bao giờ xong).
 *
 * Nhãn "đang kiểm tra" là `aria-label` của khối giữ chỗ và chỉ hiện sau `SKELETON_DELAY_MS`
 * (`components/AuthGuard.tsx`) — đường nhanh không được chớp gì — nên phải `findBy*` chứ không `getBy*`.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getUserRole: () => "admin", clearAuthToken: vi.fn() }));
vi.mock("@/lib/api", () => ({ refreshSession: () => new Promise(() => {}) }));

describe("app/admin/layout — theo ngôn ngữ người dùng", () => {
  it("locale en ⇒ admin hiện tiếng Anh", async () => {
    renderWithIntl(await AdminLayout({ children: <p>admin page</p> }), "en");
    expect(await screen.findByRole("status", { name: "Checking access..." })).toBeInTheDocument();
  });

  it("locale vi ⇒ admin hiện tiếng Việt", async () => {
    renderWithIntl(await AdminLayout({ children: <p>trang admin</p> }), "vi");
    expect(await screen.findByRole("status", { name: "Đang kiểm tra quyền truy cập..." })).toBeInTheDocument();
  });

  it("không tự khai `lang` — `<html lang>` của root layout là nguồn duy nhất", async () => {
    renderWithIntl(await AdminLayout({ children: <p>admin page</p> }), "en");
    const block = await screen.findByRole("status", { name: "Checking access..." });
    expect(block.closest("[lang]")).toBeNull();
  });
});
