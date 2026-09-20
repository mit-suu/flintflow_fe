import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRememberedEmail, saveAuthToken, setRememberedEmail } from "../../../lib/auth";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("../../../components/GoogleButton", () => ({ default: () => null }));
vi.mock("../../../lib/auth", () => ({
  saveAuthToken: vi.fn(),
  getRememberedEmail: vi.fn(),
  setRememberedEmail: vi.fn(),
}));

const fetchMock = vi.fn();
const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const renderPage = async () => {
  render(<LoginPage />);
  // chờ microtask đọc email đã nhớ
  await act(async () => {});
};

const submit = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /^Đăng nhập$/ }));
};

describe("LoginPage — Ghi nhớ đăng nhập", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(getRememberedEmail).mockReset().mockReturnValue(null);
    vi.mocked(setRememberedEmail).mockReset();
    vi.mocked(saveAuthToken).mockReset();
    fetchMock.mockReset().mockResolvedValue(jsonResponse(200, { data: { accessToken: "at", user: { role: "user" } } }));
    vi.stubGlobal("fetch", fetchMock);
    // chặn điều hướng thật của jsdom
    vi.stubGlobal("location", { href: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ô 'Ghi nhớ đăng nhập' nằm ngoài form đăng nhập, mặc định chưa tick", async () => {
    await renderPage();
    const checkbox = screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" });
    expect(checkbox).not.toBeChecked();
    expect(checkbox.closest("form")).toBeNull();
  });

  it("tick ⇒ gửi rememberMe: true, lưu token bền và nhớ email", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }));
    submit("Hiep@FlintFlow.vn", "password-123");

    await waitFor(() => expect(saveAuthToken).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ rememberMe: true });
    expect(saveAuthToken).toHaveBeenCalledWith("at", "user", { persistent: true });
    expect(setRememberedEmail).toHaveBeenCalledWith("hiep@flintflow.vn");
  });

  it("không tick ⇒ gửi rememberMe: false, token theo phiên và quên email đã nhớ", async () => {
    await renderPage();
    submit("hiep@flintflow.vn", "password-123");

    await waitFor(() => expect(saveAuthToken).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ rememberMe: false });
    expect(saveAuthToken).toHaveBeenCalledWith("at", "user", { persistent: false });
    expect(setRememberedEmail).toHaveBeenCalledWith(null);
  });

  it("lần trước có ghi nhớ ⇒ điền sẵn email và tick sẵn", async () => {
    vi.mocked(getRememberedEmail).mockReturnValue("hiep@flintflow.vn");
    await renderPage();

    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("hiep@flintflow.vn");
    expect(screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" })).toBeChecked();
  });
});
