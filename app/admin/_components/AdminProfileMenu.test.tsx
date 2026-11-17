import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMe } from "@/lib/api/users";
import { resetAccountLocaleSync } from "@/lib/hooks/use-account-locale";
import AdminProfileMenu from "./AdminProfileMenu";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api/users", () => ({
  fetchMe: vi.fn(),
  updateMyLocale: vi.fn(async () => ({})),
}));
vi.mock("@/lib/auth", () => ({ logoutAndRedirect: vi.fn() }));

const clearCookie = () => {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
};

describe("AdminProfileMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAccountLocaleSync();
    clearCookie();
    vi.mocked(fetchMe).mockResolvedValue({
      id: "admin-1",
      email: "admin@flintflow.vn",
      name: "Quản trị viên",
    } as never);
  });
  afterEach(clearCookie);

  it("mở menu tài khoản có mục liên kết tới Hồ sơ & bảo mật (/home/profile)", async () => {
    renderWithIntl(<AdminProfileMenu />, "vi");

    const trigger = screen.getByRole("button", { name: "Tài khoản" });
    expect(trigger).toBeInTheDocument();

    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);

    const profileLink = await screen.findByRole("menuitem", { name: /Hồ sơ & bảo mật/ });
    expect(profileLink).toHaveAttribute("href", "/home/profile");

    const dashboardLink = screen.getByRole("menuitem", { name: /Về Dashboard/ });
    expect(dashboardLink).toHaveAttribute("href", "/home");
  });

  it("locale en hiện Profile & security", async () => {
    renderWithIntl(<AdminProfileMenu />, "en");

    const trigger = screen.getByRole("button", { name: "Account" });
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);

    const profileLink = await screen.findByRole("menuitem", { name: /Profile & security/ });
    expect(profileLink).toHaveAttribute("href", "/home/profile");
  });

  it("đồng bộ ngôn ngữ tài khoản: đang hiển thị vi mà tài khoản là en ⇒ ghi cookie NEXT_LOCALE=en và refresh", async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      id: "admin-1",
      email: "admin@flintflow.vn",
      name: "Quản trị viên",
      locale: "en",
    } as never);

    renderWithIntl(<AdminProfileMenu />, "vi");

    await waitFor(() => {
      expect(document.cookie).toContain("NEXT_LOCALE=en");
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  });
});
