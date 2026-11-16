import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveInvitation,
  changeMemberRole,
  createInvitation,
  deleteOrganization,
  fetchInvitations,
  fetchMembers,
  fetchMyOrganizations,
  fetchOrganization,
  leaveOrganization,
  rejectInvitation,
  removeMember,
  renameOrganization,
  revokeInvitation,
  switchOrganization,
} from "@/lib/api/orgs";
import { decodeJwt, getActiveOrgId } from "@/lib/api/token-store";
import type { Invitation, OrgMember, OrgRole } from "@/types/organization";
import MembersPage from "./page";

vi.mock("@/lib/api/orgs", () => ({
  approveInvitation: vi.fn(),
  changeMemberRole: vi.fn(),
  createInvitation: vi.fn(),
  deleteOrganization: vi.fn(),
  fetchInvitations: vi.fn(),
  fetchMembers: vi.fn(),
  fetchMyOrganizations: vi.fn(),
  fetchOrganization: vi.fn(),
  leaveOrganization: vi.fn(),
  rejectInvitation: vi.fn(),
  removeMember: vi.fn(),
  renameOrganization: vi.fn(),
  revokeInvitation: vi.fn(),
  switchOrganization: vi.fn(),
}));
vi.mock("@/lib/api/token-store", () => ({
  getActiveOrgId: vi.fn(),
  getAccessToken: vi.fn(() => "token"),
  decodeJwt: vi.fn(),
}));
// TopBar cần context của AppShell (số dư, drawer) — không thuộc phạm vi test trang thành viên
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));

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

/** Hành động phá huỷ của một dòng nằm trong menu ⋮ — mở menu rồi mới lấy được mục. */
const rowAction = async (member: string, action: string) => {
  fireEvent.click(await screen.findByRole("button", { name: "Thao tác với " + member }));
  return screen.getByRole("menuitem", { name: action });
};

/** Form mời nằm trong hộp thoại, mở bằng nút cạnh tiêu đề trang. */
const openInvite = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Mời thành viên" }));
  return screen.findByRole("dialog");
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  vi.mocked(getActiveOrgId).mockReturnValue("org-a");
  vi.mocked(decodeJwt).mockReturnValue({ userId: ME });
});

describe("trang thành viên - Lead", () => {
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
    // Dòng của chính mình chỉ rời được, không tự xoá mình
    expect(await rowAction("Tôi", "Rời tổ chức")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Xoá khỏi tổ chức" })).toBeNull();
  });

  it("xoá thành viên phải qua hộp xác nhận", async () => {
    setup("lead");
    vi.mocked(removeMember).mockResolvedValue(undefined);
    renderWithIntl(<MembersPage />);

    fireEvent.click(await rowAction("Bình", "Xoá khỏi tổ chức"));
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
      requestedBy: null,
      expiresAt: "2026-10-01T00:00:00Z",
      createdAt: "2026-09-26T00:00:00Z",
    });
    renderWithIntl(<MembersPage />);

    const dialog = await openInvite();
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Vai trò" }), { target: { value: "viewer" } });
    fireEvent.change(within(dialog).getByLabelText("Email người được mời"), { target: { value: "moi@flintflow.test" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo mã mời" }));

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith("org-a", "viewer", "moi@flintflow.test"));
    expect(await screen.findByTestId("invite-code")).toHaveTextContent("ABCD234567");
  });

  it("BE từ chối vì BR-02 thì hiện câu lỗi đã dịch", async () => {
    setup("lead");
    vi.mocked(changeMemberRole).mockRejectedValue(
      new Error("Tổ chức phải còn ít nhất một Lead - hãy chỉ định người khác làm Lead trước.")
    );
    renderWithIntl(<MembersPage />);

    fireEvent.change(await screen.findByRole("combobox", { name: "Vai trò của Bình" }), { target: { value: "viewer" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("ít nhất một Lead");
  });
});

describe("trang thành viên - không phải Lead", () => {
  it("Viewer chỉ xem, không có công cụ quản lý và không tải lời mời", async () => {
    setup("viewer");
    renderWithIntl(<MembersPage />);

    expect(await screen.findByText("Chỉ Lead mới mời, đổi vai trò hoặc xoá thành viên.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mời thành viên" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Đề xuất mời thành viên" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Thao tác với Bình/ })).toBeNull();
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

    fireEvent.click(await rowAction("Tôi", "Rời tổ chức"));
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

    fireEvent.click(await rowAction("Tôi", "Rời tổ chức"));
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

describe("góp ý UI tổ chức (kiểm bằng Playwright 2026-10-04)", () => {
  it("email người được mời là bắt buộc - bỏ trống thì báo, không gọi BE", async () => {
    setup("lead");
    renderWithIntl(<MembersPage />);

    const dialog = await openInvite();
    const email = within(dialog).getByLabelText("Email người được mời");
    expect(email).toBeRequired();
    // required của trình duyệt bị bỏ qua khi submit bằng code ⇒ vẫn phải có chốt chặn trong handler
    fireEvent.submit(email.closest("form") as HTMLFormElement);
    expect(await screen.findByRole("alert")).toHaveTextContent("Hãy nhập email người được mời");
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it("tạo mã xong thì nói rõ đã gửi tới email nào", async () => {
    setup("lead");
    vi.mocked(createInvitation).mockResolvedValue({
      id: "inv-1",
      code: "ABCD234567",
      email: "moi@flintflow.test",
      role: "analyst",
      state: "pending",
      requestedBy: null,
      expiresAt: "2026-10-11T00:00:00Z",
      createdAt: "2026-10-04T00:00:00Z",
    });
    renderWithIntl(<MembersPage />);
    const dialog = await openInvite();
    fireEvent.change(within(dialog).getByLabelText("Email người được mời"), {
      target: { value: "moi@flintflow.test" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo mã mời" }));

    expect(await screen.findByText(/Đã gửi mã tới moi@flintflow.test/)).toBeInTheDocument();
  });

  it("Lead duy nhất: mục Rời tổ chức bị khoá, lời giải thích gắn vào nút mở menu", async () => {
    setup("lead");
    renderWithIntl(<MembersPage />);

    const trigger = await screen.findByRole("button", { name: "Thao tác với Tôi" });
    expect(trigger).toHaveAccessibleDescription(/Lead duy nhất/);
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Rời tổ chức" })).toBeDisabled();
  });

  it("có Lead khác thì Lead rời được", async () => {
    setup("lead");
    vi.mocked(fetchMembers).mockResolvedValue([member(ME, "lead", "Tôi"), member("u-2", "lead", "Bình")]);
    renderWithIntl(<MembersPage />);
    expect(await rowAction("Tôi", "Rời tổ chức")).toBeEnabled();
  });

  it("lỗi khi xác nhận trong hộp thoại hiện NGAY TRONG hộp thoại, không bị che sau lớp mờ", async () => {
    setup("lead");
    vi.mocked(removeMember).mockRejectedValue(new Error("Tổ chức phải còn ít nhất một Lead"));
    renderWithIntl(<MembersPage />);

    fireEvent.click(await rowAction("Bình", "Xoá khỏi tổ chức"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("ít nhất một Lead");
  });
});

describe("đổi tên tổ chức (UC-80)", () => {
  const openRename = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Đổi tên tổ chức" }));
    return screen.findByRole("dialog", { name: "Đổi tên tổ chức" });
  };

  it("Lead đổi tên: gửi tên đã cắt khoảng trắng, tiêu đề phụ hiện tên mới", async () => {
    setup("lead");
    vi.mocked(renameOrganization).mockResolvedValue({ id: "org-a", name: "Nhóm Mới", role: "lead", joinedAt: "2026-09-01T00:00:00Z" });
    renderWithIntl(<MembersPage />);
    const dialog = await openRename();
    const input = within(dialog).getByRole("textbox", { name: /Tên tổ chức/ });
    expect(input).toHaveValue("Nhóm A");
    expect(input).toHaveAttribute("maxLength", "80");
    fireEvent.change(input, { target: { value: "  Nhóm Mới  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(renameOrganization).toHaveBeenCalledWith("org-a", "Nhóm Mới"));
    expect(await screen.findByText("Thành viên của Nhóm Mới")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("tên rỗng hoặc không đổi thì nút Lưu bị khoá", async () => {
    setup("lead");
    renderWithIntl(<MembersPage />);
    const dialog = await openRename();
    const save = within(dialog).getByRole("button", { name: "Lưu" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Tên tổ chức/ }), { target: { value: "   " } });
    expect(save).toBeDisabled();
    expect(renameOrganization).not.toHaveBeenCalled();
  });

  it("BE từ chối thì lỗi hiện trong hộp thoại", async () => {
    setup("lead");
    vi.mocked(renameOrganization).mockRejectedValue(new Error("Tên tổ chức không hợp lệ"));
    renderWithIntl(<MembersPage />);
    const dialog = await openRename();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Tên tổ chức/ }), { target: { value: "Nhóm B" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tên tổ chức không hợp lệ");
    // Lỗi chỉ hiện trong hộp thoại, không lặp ở trang phía sau lớp mờ
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("không phải Lead thì không có nút đổi tên", async () => {
    setup("analyst");
    renderWithIntl(<MembersPage />);
    expect(await screen.findByText("Thành viên của Nhóm A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đổi tên tổ chức" })).not.toBeInTheDocument();
  });
});

describe("FLF-303 - Analyst đề xuất mời, Lead duyệt", () => {
  const awaiting: Invitation = {
    id: "inv-9",
    email: "moi@flintflow.test",
    role: "viewer",
    state: "awaiting_approval",
    requestedBy: { id: "u-2", name: "Bình" },
    expiresAt: "2026-11-08T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z",
  };

  it("Analyst: nút nói rõ là gửi yêu cầu; gửi xong không có mã, chỉ báo chờ Lead duyệt", async () => {
    setup("analyst");
    vi.mocked(createInvitation).mockResolvedValue(awaiting);
    renderWithIntl(<MembersPage />);

    expect(await screen.findByText(/Bạn gửi được yêu cầu mời/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Đề xuất mời thành viên" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Email người được mời"), { target: { value: "moi@flintflow.test" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu cho Lead duyệt" }));

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith("org-a", "analyst", "moi@flintflow.test"));
    expect(await within(dialog).findByText(/Lead sẽ duyệt yêu cầu mời moi@flintflow.test/)).toBeInTheDocument();
    expect(screen.queryByTestId("invite-code")).toBeNull();
  });

  it("Analyst: thấy yêu cầu của mình, huỷ được khi còn chờ; không có nút duyệt và không có khu xoá tổ chức", async () => {
    setup("analyst");
    vi.mocked(fetchInvitations).mockResolvedValue([awaiting]);
    vi.mocked(revokeInvitation).mockResolvedValue({ ...awaiting, state: "revoked" });
    renderWithIntl(<MembersPage />);

    expect(await screen.findByText("Yêu cầu mời của bạn")).toBeInTheDocument();
    expect(screen.getByText(/Chờ Lead duyệt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá tổ chức" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Huỷ yêu cầu" }));
    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith("org-a", "inv-9"));
  });

  it("Analyst: lời mời đã duyệt thì không còn nút huỷ", async () => {
    setup("analyst");
    vi.mocked(fetchInvitations).mockResolvedValue([{ ...awaiting, state: "pending" }]);
    renderWithIntl(<MembersPage />);

    await screen.findByText("moi@flintflow.test");
    expect(screen.queryByRole("button", { name: "Huỷ yêu cầu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thu hồi" })).toBeNull();
  });

  it("Lead: thấy người đề xuất, duyệt thì hiện mã vừa sinh", async () => {
    setup("lead");
    vi.mocked(fetchInvitations).mockResolvedValue([awaiting]);
    vi.mocked(approveInvitation).mockResolvedValue({ ...awaiting, state: "pending", code: "WXYZ234567" });
    renderWithIntl(<MembersPage />);

    expect(await screen.findByText("Đề xuất bởi Bình")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));

    await waitFor(() => expect(approveInvitation).toHaveBeenCalledWith("org-a", "inv-9"));
    expect(await screen.findByTestId("approved-code")).toHaveTextContent("WXYZ234567");
  });

  it("Lead: từ chối yêu cầu", async () => {
    setup("lead");
    vi.mocked(fetchInvitations).mockResolvedValue([awaiting]);
    vi.mocked(rejectInvitation).mockResolvedValue({ ...awaiting, state: "rejected" });
    renderWithIntl(<MembersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(rejectInvitation).toHaveBeenCalledWith("org-a", "inv-9"));
  });
});
