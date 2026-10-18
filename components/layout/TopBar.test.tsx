import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { fetchBalance, type BalanceResponse } from "@/lib/api/billing";
import { logoutAndRedirect } from "@/lib/auth";
import AppShell, { useAppShell } from "./AppShell";
import TopBar from "./TopBar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/home", useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ logoutAndRedirect: vi.fn(async () => undefined) }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 1250, planLabel: "Pro" })) }));
// Số dư chỉ tải cho Lead/Analyst (Viewer bị BE chặn) — xem AppSidebar.test
vi.mock("@/lib/hooks/use-active-org", () => ({ useActiveOrganization: () => ({ id: "o1", name: "Org", role: "lead" }) }));

const renderTopBar = (props: Partial<React.ComponentProps<typeof TopBar>> = {}) =>
  renderWithIntl(
    <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<nav aria-label="Điều hướng chính">sidebar</nav>}>
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

  it("FLF-265: trang vừa trừ credit gọi reloadBalance ⇒ chip số dư tải lại ngay, không chờ đổi trang", async () => {
    function SpendCredits() {
      const { reloadBalance } = useAppShell();
      return (
        <button type="button" onClick={reloadBalance}>
          Dịch xong
        </button>
      );
    }
    renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={null}>
        <TopBar trail={["Dự án"]} />
        <SpendCredits />
      </AppShell>
    );
    const chip = await screen.findByRole("link", { name: /credits/ });
    expect(chip).toHaveTextContent("1.250");

    vi.mocked(fetchBalance).mockResolvedValueOnce({ balance: 1244, planLabel: "Pro" } as BalanceResponse);
    fireEvent.click(screen.getByRole("button", { name: "Dịch xong" }));

    await waitFor(() => expect(chip).toHaveTextContent("1.244"));
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

  // Menu tài khoản chuyển từ chân thanh bên lên đây để mọi trang `/home` đều với tới được
  it("avatar mở menu tài khoản: Hồ sơ cá nhân điều hướng tới /home/profile", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản Test" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Hồ sơ cá nhân/ }));
    expect(push).toHaveBeenCalledWith("/home/profile");
  });

  it("menu tài khoản: Đăng xuất gọi logoutAndRedirect (thu hồi phiên rồi về /login)", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản Test" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Đăng xuất/ }));
    expect(logoutAndRedirect).toHaveBeenCalledOnce();
  });

  it("menu tài khoản: mục Thanh toán mang nhãn gói lấy từ BE", async () => {
    renderTopBar();
    await screen.findByRole("link", { name: /credits/ });
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản Test" }));
    expect(screen.getByRole("menuitem", { name: /Thanh toán/ })).toHaveTextContent("Gói Pro");
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
