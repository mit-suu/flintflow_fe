import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import CheckEmailPage from "./check-email/page";
import ForgotPasswordPage from "./forgot-password/page";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import ResetPasswordPage from "./reset-password/page";
import VerifyEmailPage from "./verify-email/page";

/*
 * Trang auth song ngữ (T25 · P2). Mỗi trạng thái hiển thị được mà không cần BE thật đều render ở `en` và
 * khẳng định không còn chữ tiếng Việt. Lỗi BE trả về (`json.error.message`) vẫn hiện nguyên văn — P6.
 */

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  useSearchParams: () => nav.params,
}));

const fetchMock = vi.fn();
const pending = () => new Promise<Response>(() => {});
const okJson = (data: unknown = {}) => Promise.resolve(new Response(JSON.stringify({ data, error: null }), { status: 200 }));

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.push.mockClear();
  fetchMock.mockReset().mockImplementation(pending);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Trang auth — bản en không còn tiếng Việt", () => {
  it.each([
    ["login", () => <LoginPage />],
    ["register", () => <RegisterPage />],
    ["forgot-password", () => <ForgotPasswordPage />],
    ["reset-password (thiếu token)", () => <ResetPasswordPage />],
    ["verify-email (thiếu token)", () => <VerifyEmailPage />],
    ["check-email (không có email)", () => <CheckEmailPage />],
  ])("%s", (_name, page) => {
    const { container } = renderWithIntl(page(), "en");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("reset-password có token: form + thanh độ mạnh mật khẩu", () => {
    nav.params = new URLSearchParams({ token: "t" });
    const { container } = renderWithIntl(<ResetPasswordPage />, "en");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "abcdefgh1" } });
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("verify-email có token: đang xác thực", () => {
    nav.params = new URLSearchParams({ token: "t" });
    const { container } = renderWithIntl(<VerifyEmailPage />, "en");
    expect(screen.getByRole("heading", { name: "Verifying your email…" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("verify-email thành công: đếm ngược dịch theo ngôn ngữ", async () => {
    nav.params = new URLSearchParams({ token: "t" });
    fetchMock.mockImplementation(() => okJson({ accessToken: "a", user: { role: "user" } }));
    const { container } = renderWithIntl(<VerifyEmailPage />, "en");
    expect(await screen.findByRole("heading", { name: "Verified!" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Redirecting in 3s…");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("verify-email thất bại mà BE không kèm message ⇒ dùng câu dự phòng đã dịch", async () => {
    nav.params = new URLSearchParams({ token: "t" });
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: null, error: {} }), { status: 400 })));
    const { container } = renderWithIntl(<VerifyEmailPage />, "en");
    expect(await screen.findByRole("heading", { name: "Verification failed" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("check-email có email: email in đậm trong câu", () => {
    nav.params = new URLSearchParams({ email: "a@b.co" });
    const { container } = renderWithIntl(<CheckEmailPage />, "en");
    expect(screen.getByText("a@b.co").tagName).toBe("STRONG");
    expect(container).toHaveTextContent("We sent a confirmation link to a@b.co.");
    expect(container).toHaveTextContent("Resend in 60s");
  });

  it("check-email không có email: cụm 'your email' không in đậm", () => {
    const { container } = renderWithIntl(<CheckEmailPage />, "en");
    expect(container).toHaveTextContent("We sent a confirmation link to your email.");
    expect(container.querySelector("strong")).toBeNull();
  });

  it("forgot-password gửi xong: màn 'đã gửi' dịch đủ, email in đậm", async () => {
    fetchMock.mockImplementation(() => okJson());
    const { container } = renderWithIntl(<ForgotPasswordPage />, "en");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send reset link →" }));
    });
    expect(await screen.findByRole("heading", { name: "Link sent" })).toBeInTheDocument();
    expect(screen.getByText("a@b.co").tagName).toBe("STRONG");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("register: mật khẩu xác nhận lệch ⇒ lỗi đã dịch, không gọi BE", () => {
    renderWithIntl(<RegisterPage />, "en");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "abcdefgh1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account →" }).closest("form")!);
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("login thất bại mà BE không kèm message ⇒ câu dự phòng đã dịch", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: null, error: {} }), { status: 401 })));
    const { container } = renderWithIntl(<LoginPage />, "en");
    fireEvent.change(container.querySelector("#email")!, { target: { value: "a@b.co" } });
    fireEvent.change(container.querySelector("#password")!, { target: { value: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Log in →" }));
    });
    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});

describe("Trang auth — bản vi giữ nguyên chữ cũ", () => {
  it("login: tiêu đề và nút mà e2e đang bấm (/đăng nhập/i)", () => {
    renderWithIntl(<LoginPage />, "vi");
    expect(screen.getByRole("heading", { name: "Chào mừng bạn trở lại" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đăng nhập/i })).toHaveTextContent("Đăng nhập →");
    expect(screen.getByPlaceholderText("mai@studio.vn")).toBeInTheDocument();
  });

  it("register: nhãn và độ mạnh mật khẩu", () => {
    renderWithIntl(<RegisterPage />, "vi");
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc" } });
    expect(screen.getByText("Yếu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tạo tài khoản" })).toBeInTheDocument();
  });

  it("register: email từ form cuối landing (?email=) được điền sẵn", () => {
    nav.params = new URLSearchParams({ email: " mai@congty.vn " });
    renderWithIntl(<RegisterPage />, "vi");
    expect(screen.getByLabelText("Email")).toHaveValue("mai@congty.vn");
  });

  it("check-email: câu gốc giữ nguyên", () => {
    nav.params = new URLSearchParams({ email: "a@b.co" });
    const { container } = renderWithIntl(<CheckEmailPage />, "vi");
    expect(container).toHaveTextContent("Chúng tôi đã gửi một liên kết xác nhận đến a@b.co. Vui lòng kiểm tra hộp thư đến");
    expect(container).toHaveTextContent("Gửi lại sau (60s)");
  });

  it("mọi trang dạng thẻ đều có nút chuyển ngôn ngữ", () => {
    for (const Page of [RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, CheckEmailPage, LoginPage]) {
      const { unmount } = renderWithIntl(<Page />, "vi");
      expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeInTheDocument();
      unmount();
    }
  });
});
