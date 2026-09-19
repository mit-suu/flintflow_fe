import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar, { findActiveNavIndex } from "./Sidebar";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../lib/api/billing", () => ({ fetchBalance: vi.fn().mockRejectedValue(new Error("offline")) }));
vi.mock("./NotificationBell", () => ({ useUnreadNotificationCount: () => 3 }));
vi.mock("./Logo", () => ({ default: () => null }));

const USER = { name: "hiep", plan: "Free Plan", email: "hiep@flintflow.vn" };

const renderAt = (pathname: string) => {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(<Sidebar user={USER} />);
};

const activeLinks = () =>
  screen.getAllByRole("link").filter((el) => el.getAttribute("aria-current") === "page");

describe("findActiveNavIndex", () => {
  it("khớp dài nhất; trùng href thì lấy mục đầu; không khớp ⇒ -1", () => {
    expect(findActiveNavIndex("/home")).toBe(0);
    expect(findActiveNavIndex("/home/notifications")).toBe(2);
    expect(findActiveNavIndex("/home/billing/checkout")).toBe(3);
    expect(findActiveNavIndex("/home/profile")).toBe(-1);
    expect(findActiveNavIndex("/admin")).toBe(-1);
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it("chỉ có MỘT mục 'Thông báo', kèm badge số chưa đọc", () => {
    renderAt("/home");
    expect(screen.getAllByRole("link", { name: /Thông báo/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Thông báo/ })).toHaveTextContent("3");
  });

  it.each([
    ["/home", "Trang chủ"],
    ["/home/notifications", "Thông báo"],
    ["/home/billing", "Thanh toán & credit"],
    ["/home/billing/checkout", "Thanh toán & credit"],
  ])("đang ở %s ⇒ chỉ tô nền mục '%s'", (pathname, label) => {
    renderAt(pathname);
    const active = activeLinks();
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent(label);
    expect(active[0].className).toContain("bg-[#F4F3FE]");
  });

  it("đang ở trang Hồ sơ ⇒ không mục nav nào sáng, ô avatar được tô nền", () => {
    renderAt("/home/profile");
    expect(activeLinks()).toHaveLength(0);
    const pill = screen.getByText("Free Plan").closest("[aria-current]");
    expect(pill).toHaveAttribute("aria-current", "page");
    expect(pill?.className).toContain("bg-[#F4F3FE]");
  });
});
