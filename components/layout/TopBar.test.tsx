import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import TopBar from "./TopBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/home", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 1250, planLabel: "Pro" })) }));

const renderTopBar = (props: Partial<React.ComponentProps<typeof TopBar>> = {}) =>
  renderWithIntl(
    <AppShell sidebar={<nav aria-label="Điều hướng chính">sidebar</nav>}>
      <TopBar trail={["Tài khoản", "Thông báo"]} {...props} />
    </AppShell>
  );

describe("TopBar", () => {
  it("breadcrumb: phần cuối là trang hiện tại", () => {
    renderTopBar();
    expect(screen.getByText("Thông báo")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Tài khoản")).toBeInTheDocument();
  });

  it("chip credits từ /billing/balance, link tới thanh toán", async () => {
    renderTopBar();
    const chip = await screen.findByRole("link", { name: /credits/ });
    expect(chip).toHaveTextContent("1.250");
    expect(chip).toHaveTextContent("Pro");
    expect(chip).toHaveAttribute("href", "/home/billing");
  });

  it("có nút đổi ngôn ngữ trên mọi trang đã đăng nhập", () => {
    renderTopBar();
    const group = screen.getByRole("group", { name: "Ngôn ngữ" });
    expect(within(group).getByRole("button", { name: "Tiếng Việt" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
  });

  it("render slot search và actions khi truyền", () => {
    renderTopBar({ search: <input aria-label="Tìm dự án" />, actions: <button type="button">Dự án mới</button> });
    expect(screen.getAllByRole("textbox", { name: "Tìm dự án" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Dự án mới" })).toBeInTheDocument();
  });

  it("nút Mở menu (mobile) mở drawer dạng dialog, Esc đóng và trả focus", () => {
    renderTopBar();
    const menu = screen.getByRole("button", { name: "Mở menu" });
    menu.focus();
    fireEvent.click(menu);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    // Lớp phủ chỉ có khi drawer mở
    expect(document.querySelector(".bg-inverse-surface\\/40")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".bg-inverse-surface\\/40")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menu).toHaveFocus();
  });
});
