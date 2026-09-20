import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));

const renderWith = (params: Record<string, string>) => {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(params) as unknown as ReturnType<typeof useSearchParams>
  );
  return renderWithIntl(<ForgotPasswordPage />);
};

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
  });

  it("có ?email= (mở từ trang Hồ sơ) ⇒ điền sẵn email", () => {
    renderWith({ email: "hiep@flintflow.vn" });
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("hiep@flintflow.vn");
  });

  it("?mode=create (tài khoản Google tạo mật khẩu) ⇒ tiêu đề 'Tạo mật khẩu'", () => {
    renderWith({ email: "hiep@flintflow.vn", mode: "create" });
    expect(screen.getByRole("heading", { name: "Tạo mật khẩu" })).toBeInTheDocument();
  });

  it("không có ?email= ⇒ ô email trống", () => {
    renderWith({});
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });
});
