/**
 * Thiếu `NEXT_PUBLIC_GOOGLE_CLIENT_ID` **không được** làm hỏng gì (T24).
 *
 * Bug thật: image production build mà quên truyền client id ⇒ `GoogleOAuthProvider` khởi tạo script
 * gsi với client id rỗng, script ném lỗi, React bắt được và cả trang thành "This page couldn't load" —
 * kể cả trang đăng nhập bằng mật khẩu. Test này khoá cả hai nửa của cách sửa.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUseGoogleLogin } = vi.hoisted(() => ({ mockUseGoogleLogin: vi.fn(() => vi.fn()) }));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: mockUseGoogleLogin,
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const noop = () => {};

describe("GoogleButton khi KHÔNG có client id", () => {
  it("không render gì và không gọi hook của Google", async () => {
    vi.doMock("@/lib/google-auth", () => ({ GOOGLE_CLIENT_ID: "", isGoogleAuthEnabled: false }));
    vi.resetModules();
    const { default: GoogleButton } = await import("./GoogleButton");

    const { container } = render(<GoogleButton onSuccess={noop} onError={noop} label="Tiếp tục với Google" />);
    expect(container).toBeEmptyDOMElement();
    // Gọi `useGoogleLogin` ngoài provider là chính cái ném lỗi — nó không được chạy
    expect(mockUseGoogleLogin).not.toHaveBeenCalled();
  });
});

describe("GoogleButton khi CÓ client id", () => {
  it("render nút và gắn hook", async () => {
    vi.doMock("@/lib/google-auth", () => ({ GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com", isGoogleAuthEnabled: true }));
    vi.resetModules();
    const { default: GoogleButton } = await import("./GoogleButton");

    render(<GoogleButton onSuccess={noop} onError={noop} label="Tiếp tục với Google" />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(mockUseGoogleLogin).toHaveBeenCalled();
  });
});
