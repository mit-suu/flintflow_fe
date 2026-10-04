import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminUser, setAdminUserStatus, type AdminUserDetail } from "@/lib/api/admin";
import AdminUserDetailPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "u1" }) }));
vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  fetchAdminUser: vi.fn(),
  setAdminUserStatus: vi.fn(),
}));
// TopBar của admin cần context layout — ngoài phạm vi test UC-66/67
vi.mock("../../_components/AdminPage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../_components/AdminPage")>()),
  AdminTopBar: () => null,
}));

const ACTIVE_USER: AdminUserDetail = {
  _id: "u1",
  email: "member@flintflow.vn",
  name: "Member",
  role: "user",
  isActive: true,
  suspendedAt: null,
  suspendReason: null,
  emailVerified: true,
  authProvider: "local",
  createdAt: "2026-09-01T00:00:00.000Z",
  organizationsCount: 1,
  projectsCount: 2,
  lastLoginAt: null,
  organizations: [
    { id: "o1", name: "Org Alpha", role: "lead", joinedAt: "2026-09-02T00:00:00.000Z", wallet: { balance: 1500, reserved: 20 } },
  ],
  recentTransactions: [],
};

const SUSPENDED = {
  _id: "u1",
  isActive: false,
  suspendedAt: "2026-09-29T03:00:00.000Z",
  suspendReason: "Spam tạo project",
};

const renderLoaded = async (user: AdminUserDetail = ACTIVE_USER) => {
  vi.mocked(fetchAdminUser).mockResolvedValue(user);
  renderWithIntl(<AdminUserDetailPage />);
  await screen.findByText("Trạng thái tài khoản");
};

describe("AdminUserDetailPage — khoá / mở khoá tài khoản", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminUser).mockReset();
    vi.mocked(setAdminUserStatus).mockReset();
  });

  it("hiện tổ chức tham gia kèm ví của từng tổ chức (ví thuộc org, không thuộc người)", async () => {
    await renderLoaded();

    expect(screen.getByText("Org Alpha")).toBeInTheDocument();
    // Vai trò hiện nhãn, không hiện enum `lead` (FLF-247)
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("1.500")).toBeInTheDocument();
  });

  it("khoá: bắt buộc lý do, gửi lý do đã trim rồi hiện trạng thái Đã khoá kèm lý do", async () => {
    vi.mocked(setAdminUserStatus).mockResolvedValue(SUSPENDED);
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Khoá tài khoản" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận khoá" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Lý do khoá (bắt buộc)"), { target: { value: "  Spam tạo project " } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.getByText("Đã khoá")).toBeInTheDocument());
    expect(setAdminUserStatus).toHaveBeenCalledWith("u1", { isActive: false, reason: "Spam tạo project" });
    expect(screen.getByText(/Lý do: Spam tạo project/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở khoá tài khoản" })).toBeInTheDocument();
  });

  it("mở khoá: hỏi xác nhận rồi gọi isActive=true", async () => {
    vi.mocked(setAdminUserStatus).mockResolvedValue({ _id: "u1", isActive: true, suspendedAt: null, suspendReason: null });
    await renderLoaded({ ...ACTIVE_USER, ...SUSPENDED });

    fireEvent.click(screen.getByRole("button", { name: "Mở khoá tài khoản" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở khoá" }));

    await waitFor(() => expect(screen.getByText("Hoạt động")).toBeInTheDocument());
    expect(setAdminUserStatus).toHaveBeenCalledWith("u1", { isActive: true });
  });

  it("BE từ chối ⇒ hiện lỗi, trạng thái giữ nguyên", async () => {
    vi.mocked(setAdminUserStatus).mockRejectedValue(
      new ApiClientError(400, "CANNOT_SUSPEND_SELF", "Không thể tự khoá tài khoản của chính mình")
    );
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Khoá tài khoản" }));
    fireEvent.change(screen.getByLabelText("Lý do khoá (bắt buộc)"), { target: { value: "Thử tự khoá" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khoá" }));

    await waitFor(() => expect(screen.getByText("Không thể tự khoá tài khoản của chính mình.")).toBeInTheDocument());
    expect(screen.getByText("Hoạt động")).toBeInTheDocument();
  });

  it("huỷ ⇒ không gọi API", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Khoá tài khoản" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(screen.queryByRole("button", { name: "Xác nhận khoá" })).not.toBeInTheDocument();
    expect(setAdminUserStatus).not.toHaveBeenCalled();
  });
});
