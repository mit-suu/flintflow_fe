import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "@/lib/api/projects";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import type { Project } from "@/types/project";
import AppShell from "./AppShell";
import AppSidebar from "./AppSidebar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useRouter: () => ({ push }) }));
vi.mock("@/lib/api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("@/lib/api/folders", () => ({ listFolders: vi.fn(async () => ({ data: [], error: null })) }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 120, planLabel: "Pro" })) }));
vi.mock("@/lib/api/notifications", () => ({
  fetchUnreadCount: vi.fn(async () => 3),
  onNotificationsChanged: () => () => {},
}));

const project = (id: string, updatedAt: string, over: Partial<Project> = {}): Project => ({
  _id: id,
  name: `Dự án ${id}`,
  status: "active",
  sourceMode: "fpt_template",
  createdAt: updatedAt,
  updatedAt,
  ...over,
});

const renderSidebar = (projects: Project[], pathname = "/home") => {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(listProjects).mockResolvedValue({ data: projects, error: null } as never);
  return render(
    <ProjectsProvider>
      <AppShell sidebar={<AppSidebar user={{ name: "hiep", email: "hiep@x.vn", isAdmin: false }} />}>
        <p>nội dung</p>
      </AppShell>
    </ProjectsProvider>
  );
};

describe("AppSidebar", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
  });

  it("đủ mục theo thứ tự, không trùng; mục active theo pathname", async () => {
    renderSidebar([], "/home/billing");
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links.filter((t) => t?.startsWith("Dự án"))).toHaveLength(1);

    expect(screen.getByRole("link", { name: /Credits & Thanh toán/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Dự án$/ })).not.toHaveAttribute("aria-current");
    // Số chưa đọc ở mục Thông báo
    await waitFor(() => expect(within(screen.getByRole("link", { name: /Thông báo/ })).getByText("3")).toBeInTheDocument());
  });

  it('Thành viên và đổi tổ chức: hiện, badge "Sắp có", aria-disabled, không phải link, bấm không điều hướng', () => {
    renderSidebar([]);
    for (const label of ["Thành viên", "Đổi tổ chức"]) {
      const item = screen.getByText(label).closest("[aria-disabled]") as HTMLElement;
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item.tagName).not.toBe("A");
      expect(within(item).getByText("Sắp có")).toBeInTheDocument();
      fireEvent.click(item);
    }
    expect(screen.queryByRole("link", { name: /Thành viên/ })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('"Gần đây": 3 dự án đang làm mới sửa nhất; ẩn khi chưa có dự án', async () => {
    const { unmount } = renderSidebar([]);
    await waitFor(() => expect(listProjects).toHaveBeenCalled());
    expect(screen.queryByText("Gần đây")).toBeNull();
    unmount();

    renderSidebar([
      project("a", "2026-09-01T00:00:00Z"),
      project("b", "2026-09-05T00:00:00Z"),
      project("c", "2026-09-03T00:00:00Z"),
      project("d", "2026-09-04T00:00:00Z"),
      project("e", "2026-09-09T00:00:00Z", { status: "archived" }),
    ]);
    const recent = await screen.findByRole("navigation", { name: "Dự án gần đây" });
    expect(within(recent).getAllByRole("link").map((a) => a.textContent)).toEqual(["Dự án b", "Dự án d", "Dự án c"]);
  });

  it("thu gọn: chỉ còn icon, nhớ qua localStorage", () => {
    renderSidebar([]);
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }));

    expect(window.localStorage.getItem("ff.sidebar.collapsed")).toBe("1");
    expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeInTheDocument();
    expect(screen.queryByText("Tổ chức")).toBeNull();
  });

  it("menu user: Đăng xuất về /login", () => {
    renderSidebar([]);
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản hiep" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Đăng xuất/ }));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("Gửi góp ý mở dialog", () => {
    renderSidebar([]);
    fireEvent.click(screen.getByRole("button", { name: "Gửi góp ý" }));
    expect(screen.getByRole("dialog", { name: "Gửi góp ý" })).toBeInTheDocument();
  });
});
