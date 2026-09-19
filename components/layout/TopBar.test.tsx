import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import TopBar from "./TopBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 1250, planLabel: "Pro" })) }));

const renderTopBar = (props: Partial<React.ComponentProps<typeof TopBar>> = {}) =>
  render(
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
