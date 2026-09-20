import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("../../../lib/auth", () => ({ saveAuthToken: vi.fn() }));

const push = vi.fn();
const replace = vi.fn();
const fetchMock = vi.fn();

const renderWith = (params: Record<string, string>) => {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(params) as unknown as ReturnType<typeof useSearchParams>
  );
  return renderWithIntl(<VerifyEmailPage />);
};

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const digitInputs = () => screen.getAllByLabelText(/Chữ số thứ/) as HTMLInputElement[];

describe("VerifyEmailPage (OTP)", () => {
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

  it("còn hạn: hiện đếm ngược, dán đủ 6 số thì tự gửi xác thực", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { accessToken: "at", user: { role: "user" } } }));
    renderWith({ email: "a@b.vn", exp: String(Date.now() + 120_000) });

    expect(screen.getByText(/Mã hết hạn sau/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi lại mã OTP/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Không thấy email\?/)).toBeInTheDocument();

    fireEvent.paste(digitInputs()[0], { clipboardData: { getData: () => "123456" } });

    await waitFor(() => expect(screen.getByText("Xác thực thành công!")).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/verify-email\/confirm$/);
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.vn", otp: "123456" });
  });

  it("hết hạn: khoá ô nhập, bấm 'Gửi lại mã OTP' thì gọi resend và bắt đầu đếm lại", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { otpExpiresIn: 120 } }));
    renderWith({ email: "a@b.vn", exp: String(Date.now() - 1000) });

    expect(screen.getByText(/Mã OTP đã hết hạn/)).toBeInTheDocument();
    digitInputs().forEach((input) => expect(input).toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /Gửi lại mã OTP/ }));

    await waitFor(() => expect(screen.getByText(/Mã hết hạn sau/)).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/verify-email\/resend$/);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/verify-email?email=a%40b.vn&exp="));
    digitInputs().forEach((input) => expect(input).toBeEnabled());
  });

  it("mã sai: hiện lỗi từ BE và xoá các ô để nhập lại", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: "INVALID_OTP", message: "Mã OTP không đúng. Bạn còn 4 lần thử." } })
    );
    renderWith({ email: "a@b.vn", exp: String(Date.now() + 120_000) });

    fireEvent.paste(digitInputs()[0], { clipboardData: { getData: () => "000000" } });

    await waitFor(() => expect(screen.getByText(/Bạn còn 4 lần thử/)).toBeInTheDocument());
    digitInputs().forEach((input) => expect(input.value).toBe(""));
  });
});
