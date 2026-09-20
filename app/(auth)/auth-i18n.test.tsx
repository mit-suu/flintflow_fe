import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import ForgotPasswordPage from "./forgot-password/page";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import ResetPasswordPage from "./reset-password/page";
import VerifyEmailPage from "./verify-email/page";

// Trang xác thực đều là client component dùng router + query string.
const params = new URLSearchParams({ email: "mai@studio.vn" });
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => params,
}));
vi.mock("../../components/GoogleButton", () => ({ default: () => null }));

const PAGES = [
  ["đăng nhập", <LoginPage key="login" />],
  ["đăng ký", <RegisterPage key="register" />],
  ["quên mật khẩu", <ForgotPasswordPage key="forgot" />],
  ["nhập mã xác thực", <VerifyEmailPage key="verify" />],
  ["đặt lại mật khẩu", <ResetPasswordPage key="reset" />],
] as const;

describe("Trang xác thực — song ngữ", () => {
  it.each(PAGES)("bản en của trang %s không còn chữ tiếng Việt", (_name, page) => {
    const { container } = renderWithIntl(page, "en");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("vi giữ nguyên nhãn cũ, en dịch tiêu đề và nút", () => {
    const { unmount } = renderWithIntl(<LoginPage />, "vi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chào mừng bạn trở lại");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
    unmount();

    renderWithIntl(<LoginPage />, "en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("số credit của gói Free trong tiêu đề đăng ký format theo locale", () => {
    const { unmount } = renderWithIntl(<RegisterPage />, "vi");
    expect(screen.getByText(/Miễn phí 100 credit mỗi tháng/)).toBeInTheDocument();
    unmount();

    renderWithIntl(<RegisterPage />, "en");
    expect(screen.getByText(/100 free credits every month/)).toBeInTheDocument();
  });
});
