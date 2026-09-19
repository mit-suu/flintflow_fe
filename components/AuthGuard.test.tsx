/**
 * FLF-137: AuthGuard chỉ đưa về /login khi BE thật sự từ chối refresh token. Lỗi mạng / 5xx / cold start
 * trước đây cũng gọi `clearAuthToken()` ⇒ `/auth/logout` thu hồi luôn một phiên còn hợp lệ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import AuthGuard from "./AuthGuard";

const { mockReplace, mockRefreshSession, mockIsAuthenticated } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockIsAuthenticated: vi.fn(),
}));

// useRouter thật trả object ổn định giữa các lần render — mock cũng phải vậy, nếu không effect chạy lại
const router = { replace: mockReplace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../lib/api", () => ({ refreshSession: mockRefreshSession }));
vi.mock("../lib/auth", () => ({ isAuthenticated: mockIsAuthenticated, getUserRole: () => "user" }));

const flushRetries = () => act(() => vi.advanceTimersByTimeAsync(10_000));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReplace.mockReset();
    mockRefreshSession.mockReset();
    mockIsAuthenticated.mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("token còn hạn ⇒ render nội dung, không refresh", async () => {
    mockIsAuthenticated.mockReturnValue(true);

    renderWithIntl(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("BE từ chối refresh ⇒ về /login", async () => {
    mockRefreshSession.mockResolvedValue("rejected");

    renderWithIntl(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("refresh lỗi mạng ⇒ thử lại, rồi báo lỗi kết nối — KHÔNG về /login", async () => {
    mockRefreshSession.mockResolvedValue("failed");

    renderWithIntl(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefreshSession).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
  });

  it("bấm Thử lại khi máy chủ đã lên ⇒ render nội dung", async () => {
    mockRefreshSession.mockResolvedValue("failed");
    renderWithIntl(<AuthGuard>nội dung</AuthGuard>);
    await flushRetries();

    mockRefreshSession.mockResolvedValue("ok");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await flushRetries();

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
