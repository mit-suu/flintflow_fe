import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ShellSkeleton, { type ShellMemory } from "./ShellSkeleton";

const pathname = vi.hoisted(() => ({ value: "/home/members" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const memory = (patch: Partial<ShellMemory> = {}): ShellMemory => ({
  org: { id: "o1", name: "Nhóm A", role: "lead" },
  profileName: "Như Quỳnh",
  sidebarCollapsed: false,
  ...patch,
});

describe("ShellSkeleton - khung chờ đăng nhập của /home", () => {
  it("vẽ thật phần cố định và phần đã nhớ: tên tổ chức, mục Credits, breadcrumb + tiêu đề trang", () => {
    renderWithIntl(<ShellSkeleton label="Đang kiểm tra phiên" remembered={memory()} />);
    expect(screen.getByText("Nhóm A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Credits & Thanh toán/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Thành viên");
    expect(screen.getByRole("heading", { level: 1, name: "Thành viên" })).toBeInTheDocument();
    // Thân trang là bản đang tải của chính trang Thành viên (Lead: có nút Mời)
    expect(screen.getByRole("button", { name: "Mời thành viên" })).toBeInTheDocument();
  });

  it("Viewer đã nhớ ⇒ không có mục Credits; chưa nhớ tổ chức ⇒ cũng ẩn Credits (chưa biết vai trò)", () => {
    const { unmount } = renderWithIntl(<ShellSkeleton label="Đang kiểm tra phiên" remembered={memory({ org: { id: "o1", name: "Nhóm A", role: "viewer" } })} />);
    expect(screen.queryByRole("link", { name: /Credits & Thanh toán/ })).toBeNull();
    unmount();
    renderWithIntl(<ShellSkeleton label="Đang kiểm tra phiên" remembered={memory({ org: null })} />);
    expect(screen.queryByRole("link", { name: /Credits & Thanh toán/ })).toBeNull();
    expect(screen.queryByText("Nhóm A")).toBeNull();
  });

  it("trang lạ (không có trong bảng) ⇒ khối giữ chỗ chung", () => {
    pathname.value = "/home/khong-co";
    renderWithIntl(<ShellSkeleton label="Đang kiểm tra phiên" remembered={memory()} />);
    expect(screen.getByRole("status", { name: "Đang kiểm tra phiên" })).toBeInTheDocument();
    pathname.value = "/home/members";
  });
});
