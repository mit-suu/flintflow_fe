import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logoutAndRedirect } from "../../../lib/auth";
import ResetPasswordPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("../../../lib/auth", () => ({ logoutAndRedirect: vi.fn() }));

const push = vi.fn();
const replace = vi.fn();
const fetchMock = vi.fn();

const renderWith = (params: Record<string, string>) => {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(params) as unknown as ReturnType<typeof useSearchParams>
  );
  return render(<ResetPasswordPage />);
};

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const digitInputs = () => screen.getAllByLabelText(/Chữ số thứ/) as HTMLInputElement[];
const pasteOtp = (otp: string) =>
  fireEvent.paste(digitInputs()[0], { clipboardData: { getData: () => otp } });
const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

const RESET_TOKEN = "a".repeat(64);
const validExp = () => String(Date.now() + 120_000);

describe("ResetPasswordPage (OTP 2 bước)", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push, replace } as unknown as ReturnType<typeof useRouter>);
    push.mockReset();
    replace.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bước 1 chỉ có ô OTP, chưa có ô mật khẩu", () => {
    renderWith({ email: "a@b.vn", exp: validExp() });

    expect(screen.getByText("Bước 1/2")).toBeInTheDocument();
    expect(digitInputs()).toHaveLength(6);
    expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
  });

  it("OTP đúng ⇒ sang bước 2; đặt mật khẩu gửi resetToken ⇒ thành công", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { resetToken: RESET_TOKEN, resetTokenExpiresIn: 600 } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "ok" } }));
    renderWith({ email: "a@b.vn", exp: validExp() });

    pasteOtp("123456");

    await waitFor(() => expect(screen.getByText("Bước 2/2")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/reset-password\/verify-otp$/);
    expect(bodyOf(0)).toEqual({ email: "a@b.vn", otp: "123456" });

    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "new-password-456" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "new-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu →/ }));

    await waitFor(() => expect(screen.getByText("Đặt lại mật khẩu thành công!")).toBeInTheDocument());
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/reset-password$/);
    expect(bodyOf(1)).toEqual({ resetToken: RESET_TOKEN, password: "new-password-456" });

    // Đăng xuất hẳn phiên cũ (nếu có) rồi mới sang trang đăng nhập
    fireEvent.click(screen.getByRole("button", { name: /Đăng nhập ngay/ }));
    expect(logoutAndRedirect).toHaveBeenCalledWith("/login");
  });

  it("bước 1 có dòng nhắc kiểm tra Thư rác", () => {
    renderWith({ email: "a@b.vn", exp: validExp() });
    expect(screen.getByText(/Không thấy email\?/)).toBeInTheDocument();
  });

  it("bước 2: xác nhận không khớp ⇒ báo đỏ + khoá nút; khớp ⇒ hết báo; nút mắt hiện mật khẩu xác nhận", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { resetToken: RESET_TOKEN } }));
    renderWith({ email: "a@b.vn", exp: validExp() });
    pasteOtp("123456");
    await waitFor(() => expect(screen.getByText("Bước 2/2")).toBeInTheDocument());

    const confirmInput = screen.getByLabelText("Xác nhận mật khẩu mới") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: /Đặt lại mật khẩu →/ });
    expect(screen.queryByText(/không giống với mật khẩu mới/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "new-password-456" } });
    fireEvent.change(confirmInput, { target: { value: "new-password-45" } });
    expect(screen.getByText("Mật khẩu xác nhận không giống với mật khẩu mới.")).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute("aria-invalid", "true");
    expect(submit).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "new-password-456" } });
    expect(screen.queryByText(/không giống với mật khẩu mới/)).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    expect(confirmInput.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu xác nhận" }));
    expect(confirmInput.type).toBe("text");
  });

  it("OTP sai ⇒ ở lại bước 1, hiện lỗi và xoá ô", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: "INVALID_OTP", message: "Mã OTP không đúng. Bạn còn 4 lần thử." } })
    );
    renderWith({ email: "a@b.vn", exp: validExp() });

    pasteOtp("000000");

    await waitFor(() => expect(screen.getByText(/Bạn còn 4 lần thử/)).toBeInTheDocument());
    expect(screen.getByText("Bước 1/2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
    digitInputs().forEach((input) => expect(input.value).toBe(""));
  });

  it("vé hết hạn ở bước 2 ⇒ quay lại bước 1 với nút gửi lại mã", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { resetToken: RESET_TOKEN } }))
      .mockResolvedValueOnce(
        jsonResponse(400, { error: { code: "RESET_SESSION_EXPIRED", message: "Phiên đặt lại mật khẩu đã hết hạn." } })
      );
    renderWith({ email: "a@b.vn", exp: validExp() });

    pasteOtp("123456");
    await waitFor(() => expect(screen.getByText("Bước 2/2")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "new-password-456" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "new-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu →/ }));

    await waitFor(() => expect(screen.getByText("Bước 1/2")).toBeInTheDocument());
    expect(screen.getByText(/Phiên đặt lại mật khẩu đã hết hạn/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi lại mã OTP/ })).toBeInTheDocument();
  });

  it("hết hạn ⇒ khoá ô OTP, 'Gửi lại mã OTP' gọi forgot-password và đếm lại", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { otpExpiresIn: 120 } }));
    renderWith({ email: "a@b.vn", exp: String(Date.now() - 1000) });

    digitInputs().forEach((input) => expect(input).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Gửi lại mã OTP/ }));

    await waitFor(() => expect(screen.getByText(/Mã hết hạn sau/)).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/forgot-password$/);
    expect(bodyOf(0)).toEqual({ email: "a@b.vn" });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/reset-password?email=a%40b.vn&exp="));
    digitInputs().forEach((input) => expect(input).toBeEnabled());
  });
});
