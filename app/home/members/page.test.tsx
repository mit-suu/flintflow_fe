import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeMemberRole,
  createInvitation,
  deleteOrganization,
  fetchInvitations,
  fetchMembers,
  fetchMyOrganizations,
  fetchOrganization,
  leaveOrganization,
  removeMember,
  switchOrganization,
} from "@/lib/api/orgs";
import { decodeJwt, getActiveOrgId } from "@/lib/api/token-store";
import type { OrgMember, OrgRole } from "@/types/organization";
import MembersPage from "./page";

vi.mock("@/lib/api/orgs", () => ({
  changeMemberRole: vi.fn(),
  createInvitation: vi.fn(),
  deleteOrganization: vi.fn(),
  fetchInvitations: vi.fn(),
  fetchMembers: vi.fn(),
  fetchMyOrganizations: vi.fn(),
  fetchOrganization: vi.fn(),
  leaveOrganization: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  switchOrganization: vi.fn(),
}));
vi.mock("@/lib/api/token-store", () => ({
  getActiveOrgId: vi.fn(),
  getStoredAuthToken: vi.fn(() => "token"),
  decodeJwt: vi.fn(),
}));

const assign = vi.fn();
const ME = "u-me";

const member = (userId: string, role: OrgRole, name: string): OrgMember => ({
  userId,
  email: userId + "@flintflow.test",
  name,
  role,
  joinedAt: "2026-09-01T00:00:00Z",
});

const setup = (myRole: OrgRole) => {
  vi.mocked(fetchOrganization).mockResolvedValue({
    id: "org-a",
    name: "Nhóm A",
    role: myRole,
    joinedAt: "2026-09-01T00:00:00Z",
    memberCount: 2,
  });
  vi.mocked(fetchMembers).mockResolvedValue([member(ME, myRole, "Tôi"), member("u-2", "analyst", "Bình")]);
  vi.mocked(fetchInvitations).mockResolvedValue([]);
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  vi.mocked(getActiveOrgId).mockReturnValue("org-a");
  vi.mocked(decodeJwt).mockReturnValue({ userId: ME });
});

describe("trang thành viên — Lead", () => {
  it("đổi vai trò một thành viên khác", async () => {
    setup("lead");
    vi.mocked(changeMemberRole).mockResolvedValue(member("u-2", "viewer", "Bình"));
    renderWithIntl(<MembersPage />);

    const select = await screen.findByRole("combobox", { name: "Vai trò của Bình" });
    fireEvent.change(select, { target: { value: "viewer" } });

    await waitFor(() => expect(changeMemberRole).toHaveBeenCalledWith("org-a", "u-2", "viewer"));
  });

  it("không có ô đổi vai trò hay nút xoá cho chính mình", async () => {
    setup("lead");
    renderWithIntl(<MembersPage />);

    await screen.findByText("Bình");
    expect(screen.queryByRole("combobox", { name: "Vai trò của Tôi" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Xoá khỏi tổ chức" })).toHaveLength(1);
  });

  it("xoá thành viên phải qua hộp xác nhận", async () => {
    setup("lead");
    vi.mocked(removeMember).mockResolvedValue(undefined);
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Xoá khỏi tổ chức" }));
    expect(removeMember).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("org-a", "u-2"));
  });

  it("tạo mã mời thì hiện mã thô đúng một lần", async () => {
    setup("lead");
    vi.mocked(createInvitation).mockResolvedValue({
      id: "inv-1",
      code: "ABCD234567",
      email: "moi@flintflow.test",
      role: "viewer",
      state: "pending",
      expiresAt: "2026-10-01T00:00:00Z",
      createdAt: "2026-09-26T00:00:00Z",
    });
    renderWithIntl(<MembersPage />);

    fireEvent.change(await screen.findByRole("combobox", { name: "Vai trò" }), { target: { value: "viewer" } });
    fireEvent.change(screen.getByLabelText("Email (không bắt buộc)"), { target: { value: "moi@flintflow.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo mã mời" }));

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith("org-a", "viewer", "moi@flintflow.test"));
    expect(await screen.findByTestId("invite-code")).toHaveTextContent("ABCD234567");
  });

  it("BE từ chối vì BR-02 thì hiện câu lỗi đã dịch", async () => {
    setup("lead");
    vi.mocked(changeMemberRole).mockRejectedValue(
      new Error("Tổ chức phải còn ít nhất một Lead — hãy chỉ định người khác làm Lead trước.")
    );
    renderWithIntl(<MembersPage />);

    fireEvent.change(await screen.findByRole("combobox", { name: "Vai trò của Bình" }), { target: { value: "viewer" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("ít nhất một Lead");
  });
});

describe("trang thành viên — không phải Lead", () => {
  it("chỉ xem, không có công cụ quản lý và không tải lời mời", async () => {
    setup("analyst");
    renderWithIntl(<MembersPage />);

    expect(await screen.findByText("Chỉ Lead mới mời, đổi vai trò hoặc xoá thành viên.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá khỏi tổ chức" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo mã mời" })).toBeNull();
    expect(fetchInvitations).not.toHaveBeenCalled();
  });

  it("rời tổ chức: còn org khác thì mở org đó", async () => {
    setup("analyst");
    vi.mocked(leaveOrganization).mockResolvedValue(undefined);
    vi.mocked(fetchMyOrganizations).mockResolvedValue([
      { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
    ]);
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: { id: "org-b", name: "Nhóm B", role: "viewer", joinedAt: "2026-09-02T00:00:00Z" },
    });
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rời tổ chức" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(leaveOrganization).toHaveBeenCalledWith("org-a"));
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-b"));
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("rời tổ chức cuối cùng thì về onboarding", async () => {
    setup("analyst");
    vi.mocked(leaveOrganization).mockResolvedValue(undefined);
    vi.mocked(fetchMyOrganizations).mockResolvedValue([]);
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rời tổ chức" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home/onboarding"));
    expect(switchOrganization).not.toHaveBeenCalled();
  });
});

describe("xoá tổ chức", () => {
  const setupAlone = () => {
    setup("lead");
    vi.mocked(fetchMembers).mockResolvedValue([member(ME, "lead", "Tôi")]);
  };

  it("còn thành viên khác thì nút xoá bị khoá và có giải thích", async () => {
    setup("lead");
    renderWithIntl(<MembersPage />);

    expect(await screen.findByRole("button", { name: "Xoá tổ chức" })).toBeDisabled();
    expect(screen.getByText(/Chỉ xoá được khi bạn là thành viên duy nhất/)).toBeInTheDocument();
  });

  it("không phải Lead thì không thấy khu xoá", async () => {
    setup("analyst");
    renderWithIntl(<MembersPage />);

    await screen.findByText("Bình");
    expect(screen.queryByRole("button", { name: "Xoá tổ chức" })).toBeNull();
  });

  it("chỉ xoá được khi gõ đúng tên tổ chức, xong thì về onboarding nếu hết org", async () => {
    setupAlone();
    vi.mocked(deleteOrganization).mockResolvedValue({ deleted: true, projectsDeleted: 3 });
    vi.mocked(fetchMyOrganizations).mockResolvedValue([]);
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Xoá tổ chức" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Xoá vĩnh viễn" });
    const input = within(dialog).getByLabelText(/Gõ lại tên tổ chức/);

    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "Nhóm B" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "Nhóm A" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith("org-a", "Nhóm A"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home/onboarding"));
  });

  it("đóng hộp thoại thì xoá chữ đã gõ", async () => {
    setupAlone();
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Xoá tổ chức" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Gõ lại tên tổ chức/), { target: { value: "Nhóm A" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));

    fireEvent.click(screen.getByRole("button", { name: "Xoá tổ chức" }));
    const reopened = await screen.findByRole("dialog");
    expect(within(reopened).getByRole("button", { name: "Xoá vĩnh viễn" })).toBeDisabled();
  });
});
