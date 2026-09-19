import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("../../../components/GoogleButton", () => ({ default: () => null }));

describe("RegisterPage — ô xác nhận mật khẩu", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
  });

  it("không khớp ⇒ báo đỏ + khoá nút; khớp ⇒ hết báo; nút mắt hiện mật khẩu xác nhận", () => {
    render(<RegisterPage />);

    const confirmInput = screen.getByLabelText("Xác nhận mật khẩu") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: /Tạo tài khoản →/ });
    expect(screen.queryByText(/không giống với mật khẩu/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "password-123" } });
    fireEvent.change(confirmInput, { target: { value: "password-12" } });
    expect(screen.getByText("Mật khẩu xác nhận không giống với mật khẩu.")).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute("aria-invalid", "true");
    expect(submit).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "password-123" } });
    expect(screen.queryByText(/không giống với mật khẩu/)).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    expect(confirmInput.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu xác nhận" }));
    expect(confirmInput.type).toBe("text");
  });
});
