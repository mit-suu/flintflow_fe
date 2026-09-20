import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
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
    renderWithIntl(<RegisterPage />);

    const confirmInput = screen.getByLabelText("Xác nhận mật khẩu") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: /^Tạo tài khoản$/ });
    expect(screen.queryByText(/không giống với mật khẩu/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Mua2Roi!TrenPho" } });
    fireEvent.change(confirmInput, { target: { value: "Mua2Roi!TrenPh" } });
    expect(screen.getByText("Mật khẩu xác nhận không giống với mật khẩu.")).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute("aria-invalid", "true");
    expect(submit).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "Mua2Roi!TrenPho" } });
    expect(screen.queryByText(/không giống với mật khẩu/)).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    expect(confirmInput.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu xác nhận" }));
    expect(confirmInput.type).toBe("text");
  });

  const fillPasswords = (value: string) => {
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value } });
  };

  it("mật khẩu yếu ⇒ nêu lý do và khoá nút, dù ô xác nhận đã khớp", () => {
    renderWithIntl(<RegisterPage />);
    fillPasswords("matkhau2026");

    expect(screen.getByText(/3 trong 4 nhóm/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tạo tài khoản$/ })).toBeDisabled();
  });

  it("qua hết luật cứng nhưng mới mức 'Trung bình' ⇒ vẫn khoá: ngưỡng là 'Khá'", () => {
    renderWithIntl(<RegisterPage />);
    fillPasswords("muaroi2!");

    expect(screen.getByText(/Trung bình — chưa dùng được/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tạo tài khoản$/ })).toBeDisabled();
  });

  it("tiếng Việt có dấu ⇒ khoá nút", () => {
    renderWithIntl(<RegisterPage />);
    fillPasswords("Đườngxưa1!");

    expect(screen.getByText(/không dấu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tạo tài khoản$/ })).toBeDisabled();
  });
});
