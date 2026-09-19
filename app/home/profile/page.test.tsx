import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { changeMyPassword, fetchMe, updateMyName } from "@/lib/api/users";
import type { User } from "@/types/user";
import ProfilePage from "./page";

vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn(), updateMyName: vi.fn(), changeMyPassword: vi.fn() }));
// TopBar cần context của AppShell (số dư, drawer) — không thuộc phạm vi test trang hồ sơ
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));

const LOCAL_USER: User = {
  id: "u1",
  email: "hiep@flintflow.vn",
  name: "Hiệp",
  balance: 1200,
  createdAt: "2026-09-01T00:00:00.000Z",
  authProvider: "local",
  emailVerified: true,
  hasPassword: true,
};

const renderLoaded = async (user: User = LOCAL_USER) => {
  vi.mocked(fetchMe).mockResolvedValue(user);
  render(<ProfilePage />);
  await screen.findByText("Thông tin cá nhân");
};

const fillPasswordForm = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: confirm } });
};

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.mocked(fetchMe).mockReset();
    vi.mocked(updateMyName).mockReset();
    vi.mocked(changeMyPassword).mockReset();
  });

  it("hiện thông tin cá nhân từ /users/me", async () => {
    await renderLoaded();

    expect(screen.getAllByText("hiep@flintflow.vn").length).toBeGreaterThan(0);
    expect(screen.getByText("✓ Đã xác thực")).toBeInTheDocument();
    expect(screen.getByText("Email/mật khẩu")).toBeInTheDocument();
    expect(screen.getByText("1.200 credit")).toBeInTheDocument();
  });

  it("sửa tên hiển thị ⇒ gọi updateMyName và hiện tên mới", async () => {
    vi.mocked(updateMyName).mockResolvedValue({ ...LOCAL_USER, name: "Tuấn Hiệp" });
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "  Tuấn Hiệp " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(screen.getByText("Đã cập nhật tên hiển thị.")).toBeInTheDocument());
    expect(updateMyName).toHaveBeenCalledWith("Tuấn Hiệp");
    expect(screen.getAllByText("Tuấn Hiệp").length).toBeGreaterThan(0);
  });

  it("đổi mật khẩu thành công ⇒ báo thành công và xoá các ô", async () => {
    vi.mocked(changeMyPassword).mockResolvedValue(undefined);
    await renderLoaded();

    fillPasswordForm("old-password-123", "new-password-456", "new-password-456");
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    await waitFor(() => expect(screen.getByText(/Đổi mật khẩu thành công/)).toBeInTheDocument());
    expect(changeMyPassword).toHaveBeenCalledWith("old-password-123", "new-password-456");
    expect((screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement).value).toBe("");
  });

  it("sai mật khẩu hiện tại ⇒ báo đỏ ngay dưới ô mật khẩu hiện tại", async () => {
    vi.mocked(changeMyPassword).mockRejectedValue(
      new ApiClientError(400, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng.")
    );
    await renderLoaded();

    fillPasswordForm("wrong-password", "new-password-456", "new-password-456");
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    await waitFor(() => expect(screen.getByText("Mật khẩu hiện tại không đúng.")).toBeInTheDocument());
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveAttribute("aria-invalid", "true");
  });

  it("xác nhận không khớp ⇒ báo đỏ và khoá nút; mỗi ô có nút mắt riêng", async () => {
    await renderLoaded();

    fillPasswordForm("old-password-123", "new-password-456", "new-password-45");
    expect(screen.getByText("Mật khẩu xác nhận không giống với mật khẩu mới.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();

    const confirmInput = screen.getByLabelText("Xác nhận mật khẩu mới") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Hiện xác nhận mật khẩu mới" }));
    expect(confirmInput.type).toBe("text");
    expect((screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement).type).toBe("password");
  });

  it("mật khẩu mới trùng mật khẩu hiện tại ⇒ báo đỏ, khoá nút", async () => {
    await renderLoaded();

    fillPasswordForm("same-password-1", "same-password-1", "same-password-1");
    expect(screen.getByText("Mật khẩu mới phải khác mật khẩu hiện tại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
  });

  it("'Quên mật khẩu hiện tại?' mang sẵn email và nhắc sẽ phải đăng nhập lại", async () => {
    await renderLoaded();

    expect(screen.getByRole("link", { name: "Quên mật khẩu hiện tại?" })).toHaveAttribute(
      "href",
      "/forgot-password?email=hiep%40flintflow.vn"
    );
    expect(screen.getByText("Sau khi đặt lại, bạn sẽ cần đăng nhập lại.")).toBeInTheDocument();
  });

  it("tài khoản Google chưa có mật khẩu ⇒ không có form đổi, có nút tạo mật khẩu qua email", async () => {
    await renderLoaded({ ...LOCAL_USER, authProvider: "google", hasPassword: false });

    expect(screen.getByText(/đăng nhập bằng Google nên chưa có mật khẩu/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mật khẩu hiện tại")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo mật khẩu qua email/ })).toHaveAttribute(
      "href",
      "/forgot-password?email=hiep%40flintflow.vn&mode=create"
    );
  });
});
