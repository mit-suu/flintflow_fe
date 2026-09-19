/**
 * FLF-137: AuthGuard chỉ đưa về /login khi BE thật sự từ chối refresh token. Lỗi mạng / 5xx / cold start
 * trước đây cũng gọi `clearAuthToken()` ⇒ `/auth/logout` thu hồi luôn một phiên còn hợp lệ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AuthGuard from "./AuthGuard";

<<<<<<< HEAD
const { mockReplace, mockRefreshSession, mockIsAuthenticated } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
=======
const { mockReplace, mockRefreshSession, mockIsAuthenticated, mockLogoutAndRedirect } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLogoutAndRedirect: vi.fn(),
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
  mockRefreshSession: vi.fn(),
  mockIsAuthenticated: vi.fn(),
}));

// useRouter thật trả object ổn định giữa các lần render — mock cũng phải vậy, nếu không effect chạy lại
const router = { replace: mockReplace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../lib/api", () => ({ refreshSession: mockRefreshSession }));
<<<<<<< HEAD
vi.mock("../lib/auth", () => ({ isAuthenticated: mockIsAuthenticated, getUserRole: () => "user" }));
=======
vi.mock("../lib/auth", () => ({
  isAuthenticated: mockIsAuthenticated,
  getUserRole: () => "user",
  logoutAndRedirect: mockLogoutAndRedirect,
}));
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099

const flushRetries = () => act(() => vi.advanceTimersByTimeAsync(10_000));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReplace.mockReset();
    mockRefreshSession.mockReset();
<<<<<<< HEAD
=======
    mockLogoutAndRedirect.mockReset().mockResolvedValue(undefined);
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
    mockIsAuthenticated.mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("token còn hạn ⇒ render nội dung, không refresh", async () => {
    mockIsAuthenticated.mockReturnValue(true);

    render(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

<<<<<<< HEAD
  it("BE từ chối refresh ⇒ về /login", async () => {
=======
  it("BE từ chối refresh ⇒ đăng xuất hẳn (xoá cookie HttpOnly) rồi về /login", async () => {
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
    mockRefreshSession.mockResolvedValue("rejected");

    render(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

<<<<<<< HEAD
    expect(mockReplace).toHaveBeenCalledWith("/login");
=======
    expect(mockLogoutAndRedirect).toHaveBeenCalledTimes(1);
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("refresh lỗi mạng ⇒ thử lại, rồi báo lỗi kết nối — KHÔNG về /login", async () => {
    mockRefreshSession.mockResolvedValue("failed");

    render(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

<<<<<<< HEAD
    expect(mockReplace).not.toHaveBeenCalled();
=======
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
    expect(mockRefreshSession).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
  });

  it("bấm Thử lại khi máy chủ đã lên ⇒ render nội dung", async () => {
    mockRefreshSession.mockResolvedValue("failed");
    render(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    mockRefreshSession.mockResolvedValue("ok");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await flushRetries();

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
