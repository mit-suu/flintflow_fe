import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMe } from "@/lib/api/users";
import AdminProfileMenu from "./AdminProfileMenu";

vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn() }));
vi.mock("@/lib/auth", () => ({ logoutAndRedirect: vi.fn() }));

describe("AdminProfileMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMe).mockResolvedValue({
      id: "admin-1",
      email: "admin@flintflow.vn",
      name: "Quản trị viên",
    } as never);
  });

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
});
