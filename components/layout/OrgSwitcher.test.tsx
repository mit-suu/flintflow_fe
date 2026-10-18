import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import OrgSwitcher from "./OrgSwitcher";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/home" }));
vi.mock("@/lib/api/orgs", () => ({ fetchMyOrganizations: vi.fn(), switchOrganization: vi.fn() }));

const assign = vi.fn();
const ACTIVE = { id: "org-a", name: "Nhóm A", role: "lead" } as const;

const ORGS = [
  { id: "org-a", name: "Nhóm A", role: "lead", joinedAt: "2026-09-01T00:00:00Z" },
  { id: "org-b", name: "Nhóm B", role: "analyst", joinedAt: "2026-09-02T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  vi.mocked(fetchMyOrganizations).mockResolvedValue(ORGS as never);
  vi.mocked(switchOrganization).mockResolvedValue({ accessToken: "t", organization: ORGS[1] } as never);
});

const open = async () => {
  renderWithIntl(<OrgSwitcher activeOrg={{ ...ACTIVE }} collapsed={false} />);
  // Danh sách chỉ tải khi mở menu — thanh bên nằm trên mọi trang, tải sẵn là tốn request mỗi lần đổi trang
  expect(fetchMyOrganizations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Đổi tổ chức/ }));
  await waitFor(() => expect(fetchMyOrganizations).toHaveBeenCalled());
};

describe("OrgSwitcher", () => {
  it("mở menu mới tải danh sách, hiện vai trò và lối tạo/tham gia", async () => {
    await open();

    expect(await screen.findByRole("menuitem", { name: /Nhóm B/ })).toHaveTextContent("Analyst");
    expect(screen.getByRole("menuitem", { name: /Tạo hoặc tham gia/ })).toBeInTheDocument();
  });

  it("chọn tổ chức khác thì đổi rồi TẢI LẠI /home, không điều hướng phía client", async () => {
    await open();

    fireEvent.click(await screen.findByRole("menuitem", { name: /Nhóm B/ }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-b"));
    // Tải lại hẳn: ProjectsProvider ở layout đang giữ dự án và số dư của tổ chức cũ
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home"));
    expect(push).not.toHaveBeenCalled();
  });

  it("bấm lại tổ chức đang mở thì không gọi BE", async () => {
    await open();

    fireEvent.click(await screen.findByRole("menuitem", { name: /Nhóm A/ }));

    expect(switchOrganization).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("không tải được danh sách thì vẫn còn lối tạo/tham gia", async () => {
    vi.mocked(fetchMyOrganizations).mockRejectedValue(new Error("đứt mạng"));
    await open();

    expect(await screen.findByText("Không tải được danh sách tổ chức.")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Tạo hoặc tham gia/ })).toBeInTheDocument();
  });
});
