import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import { updateMyPreferredOrganization } from "@/lib/api/users";
import { getActiveOrgId } from "@/lib/api/token-store";
import OrganizationsPage from "./page";

vi.mock("@/lib/api/orgs", () => ({ fetchMyOrganizations: vi.fn(), switchOrganization: vi.fn() }));
vi.mock("@/lib/api/users", () => ({ updateMyPreferredOrganization: vi.fn() }));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));
// Trang có `TopBar`, và `TopBar` đọc context của `AppShell` (chip credits, nút mở menu) — nên test phải dựng
// đúng khung đó. Khung gọi `GET /billing/balance` và `usePathname`, hai thứ phải mock theo.
vi.mock("next/navigation", () => ({
  usePathname: () => "/home/organizations",
  // `TopBar` chứa `LocaleSwitcher`, nó điều hướng khi đổi ngôn ngữ
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => null) }));
vi.mock("@/lib/hooks/use-active-org", () => ({
  useActiveOrganization: () => ({ id: "org-a", name: "Nhóm A", role: "lead" }),
  useActiveOrganizationState: () => ({ org: { id: "org-a", name: "Nhóm A", role: "lead" }, loading: false, error: false }),
}));

const assign = vi.fn();

const renderPage = () =>
  renderWithIntl(
    <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}>
      <OrganizationsPage />
    </AppShell>
  );

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  vi.mocked(getActiveOrgId).mockReturnValue("org-a");
  vi.mocked(fetchMyOrganizations).mockResolvedValue([
    { id: "org-a", name: "Nhóm A", role: "lead", joinedAt: "2026-09-01T00:00:00Z" },
    { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
  ]);
});

describe("đổi tổ chức (UC-10)", () => {
  it("liệt kê org kèm vai trò, đánh dấu org đang mở", async () => {
    renderPage();

    expect(await screen.findByText("Nhóm A")).toBeInTheDocument();
    expect(screen.getByText("Nhóm B")).toBeInTheDocument();
    expect(screen.getByText("Vai trò: Viewer")).toBeInTheDocument();
    // "Đang mở" là huy hiệu trạng thái, không phải nút; cạnh đó là link thật để vào làm việc
    expect(screen.getByText("Đang mở").tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: "Đang mở" })).toBeNull();
    expect(screen.getByRole("link", { name: "Vào dự án" })).toHaveAttribute("href", "/home");
    // Chỉ org khác mới có nút mở
    expect(screen.getAllByRole("button", { name: "Mở tổ chức này" })).toHaveLength(1);
  });

  it("mở org khác thì đổi token rồi tải lại hẳn /home", async () => {
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Mở tổ chức này" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-b"));
    // Tải lại hẳn chứ không router.push: danh sách dự án trong bộ nhớ đang là của org cũ
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("từ 2 tổ chức trở lên có checkbox ghi nhớ mặc định; tick vào thì gửi kèm rememberAsDefault: true", async () => {
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
    });
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: "Ghi nhớ lựa chọn cho lần đăng nhập sau" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Mở tổ chức này" }));
    await waitFor(() =>
      expect(switchOrganization).toHaveBeenCalledWith("org-b", { rememberAsDefault: true })
    );
  });

  it("tổ chức đang là mặc định hiện huy hiệu “Mặc định khi đăng nhập” và nút “Bỏ ghi nhớ”", async () => {
    vi.mocked(fetchMyOrganizations).mockResolvedValue([
      { id: "org-a", name: "Nhóm A", role: "lead", joinedAt: "2026-09-01T00:00:00Z", isDefault: true },
      { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
    ]);
    vi.mocked(updateMyPreferredOrganization).mockResolvedValue({ id: "u1", email: "test@flintflow.vn" } as never);

    renderPage();

    expect(await screen.findByText("Mặc định khi đăng nhập")).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: "Bỏ ghi nhớ" });

    fireEvent.click(clearBtn);

    await waitFor(() => expect(updateMyPreferredOrganization).toHaveBeenCalledWith(null));
    await waitFor(() => expect(screen.queryByText("Mặc định khi đăng nhập")).toBeNull());
  });

  it("tổ chức đang mở chưa là mặc định có nút “Ghi nhớ khi đăng nhập”; bấm thì lưu theo tài khoản (FLF-427)", async () => {
    vi.mocked(updateMyPreferredOrganization).mockResolvedValue({ id: "u1", email: "test@flintflow.vn" } as never);
    renderPage();

    // Chỉ tổ chức đang mở (org-a) có nút này — org khác dùng checkbox + "Mở tổ chức này"
    const setBtn = await screen.findByRole("button", { name: "Ghi nhớ khi đăng nhập" });
    expect(screen.getAllByRole("button", { name: "Ghi nhớ khi đăng nhập" })).toHaveLength(1);

    fireEvent.click(setBtn);

    await waitFor(() => expect(updateMyPreferredOrganization).toHaveBeenCalledWith("org-a"));
    expect(await screen.findByText("Mặc định khi đăng nhập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ ghi nhớ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi nhớ khi đăng nhập" })).toBeNull();
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("chỉ có một tổ chức thì không hiện nút “Ghi nhớ khi đăng nhập”", async () => {
    vi.mocked(fetchMyOrganizations).mockResolvedValue([
      { id: "org-a", name: "Nhóm A", role: "lead", joinedAt: "2026-09-01T00:00:00Z" },
    ]);
    renderPage();

    expect(await screen.findByText("Nhóm A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi nhớ khi đăng nhập" })).toBeNull();
  });

  it("chưa có activeOrgId thì không hiển thị TopBar (tránh crash context)", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    renderWithIntl(<OrganizationsPage />);

    // TopBar chứa đường dẫn breadcrumb [tc("account"), t("title")] - khi render không có AppShell, nếu có TopBar sẽ crash
    expect(await screen.findByText("Nhóm A")).toBeInTheDocument();
  });

  it("có lối tạo hoặc tham gia thêm tổ chức", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: "Tạo hoặc tham gia" })).toHaveAttribute("href", "/home/onboarding");
  });

  it("đang tải thì hiện skeleton, KHÔNG phải danh sách rỗng", async () => {
    // Danh sách chưa về: trước đây `orgs ?? []` làm trang nói user không thuộc tổ chức nào
    vi.mocked(fetchMyOrganizations).mockReturnValue(new Promise(() => {}));
    renderPage();

    const skeleton = await screen.findByTestId("page-skeleton");
    expect(skeleton).toHaveAttribute("data-variant", "list");
    expect(screen.queryByText("Bạn chưa thuộc tổ chức nào")).toBeNull();
  });

  it("không có tổ chức nào thì hiện trạng thái rỗng có lối sang onboarding", async () => {
    vi.mocked(fetchMyOrganizations).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Bạn chưa thuộc tổ chức nào")).toBeInTheDocument();
    expect(screen.queryByTestId("page-skeleton")).toBeNull();
    // Một lối đi duy nhất, không hai link cùng tên: khối "thêm tổ chức" nhường chỗ cho trạng thái rỗng
    const cta = screen.getAllByRole("link", { name: "Tạo hoặc tham gia" });
    expect(cta).toHaveLength(1);
    expect(cta[0]).toHaveAttribute("href", "/home/onboarding");
  });

  it("chưa có org đang mở (getActiveOrgId = null, ngoài AppShell): render danh sách org không cần TopBar và không đánh dấu Đang mở", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: { id: "org-a", name: "Nhóm A", role: "lead", joinedAt: "2026-09-01T00:00:00Z" },
    });

    renderWithIntl(<OrganizationsPage />);

    expect(await screen.findByText("Nhóm A")).toBeInTheDocument();
    expect(screen.getByText("Nhóm B")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
    expect(screen.queryByText("Đang mở")).not.toBeInTheDocument();
    const switchButtons = screen.getAllByRole("button", { name: "Mở tổ chức này" });
    expect(switchButtons).toHaveLength(2);

    fireEvent.click(switchButtons[0]);
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-a"));
    expect(assign).toHaveBeenCalledWith("/home");
  });
});
