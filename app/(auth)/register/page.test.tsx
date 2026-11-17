import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAuthToken } from "../../../lib/auth";
import RegisterPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("../../../lib/auth", () => ({ saveAuthToken: vi.fn() }));
vi.mock("../../../components/GoogleButton", () => ({
  default: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button data-testid="google-button" type="button" onClick={() => onSuccess("google-id-token")}>
      Google
    </button>
  ),
}));

describe("RegisterPage - ô xác nhận mật khẩu", () => {
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

    expect(screen.getByText(/Trung bình - chưa dùng được/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tạo tài khoản$/ })).toBeDisabled();
  });

  it("tiếng Việt có dấu ⇒ khoá nút", () => {
    renderWithIntl(<RegisterPage />);
    fillPasswords("Đườngxưa1!");

    expect(screen.getByText(/không dấu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tạo tài khoản$/ })).toBeDisabled();
  });
});

describe("RegisterPage - Google & tài khoản bị khoá", () => {
  const fetchMock = vi.fn();
  const jsonResponse = (status: number, body: unknown) =>
    ({ ok: status < 400, status, json: async () => body }) as Response;

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(saveAuthToken).mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { href: "", pathname: "/register" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Google thành công ⇒ lưu token với role, điều hướng theo resolvePostAuthDestination", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: {
          accessToken: "at-google",
          user: { role: "user", locale: "en" },
          needsOnboarding: true,
          organizations: [],
        },
      })
    );

    renderWithIntl(<RegisterPage />);
    fireEvent.click(screen.getByTestId("google-button"));

    await waitFor(() => expect(saveAuthToken).toHaveBeenCalledWith("at-google", "user", { persistent: true }));
    expect(window.location.href).toBe("/home/onboarding");
  });

  it("Google trả ACCOUNT_SUSPENDED ⇒ hiện khối cảnh báo khoá tài khoản", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        data: null,
        error: { code: "ACCOUNT_SUSPENDED", message: "Tài khoản bị khoá" },
        meta: { reason: "Vi phạm quy định", suspended_at: "2026-11-01T10:00:00Z" },
      })
    );

    renderWithIntl(<RegisterPage />);
    fireEvent.click(screen.getByTestId("google-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Tài khoản của bạn đã bị khoá.");
    expect(alert).toHaveTextContent("Lý do: Vi phạm quy định");
    expect(saveAuthToken).not.toHaveBeenCalled();
  });
});
