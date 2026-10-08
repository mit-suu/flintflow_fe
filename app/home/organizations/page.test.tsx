import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import OrganizationsPage from "./page";

vi.mock("@/lib/api/orgs", () => ({ fetchMyOrganizations: vi.fn(), switchOrganization: vi.fn() }));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));

const assign = vi.fn();

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
    renderWithIntl(<OrganizationsPage />);

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
    renderWithIntl(<OrganizationsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Mở tổ chức này" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-b"));
    // Tải lại hẳn chứ không router.push: danh sách dự án trong bộ nhớ đang là của org cũ
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("có lối tạo hoặc tham gia thêm tổ chức", async () => {
    renderWithIntl(<OrganizationsPage />);
    expect(await screen.findByRole("link", { name: "Tạo hoặc tham gia" })).toHaveAttribute("href", "/home/onboarding");
  });
});
