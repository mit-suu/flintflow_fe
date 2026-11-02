import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UC-03 (FLF-345): bị khoá giữa phiên ⇒ đăng xuất về /login, lý do đi qua sessionStorage.
const logoutAndRedirect = vi.fn(async () => {});
vi.mock("../auth", () => ({
  clearAuthToken: vi.fn(async () => {}),
  logoutAndRedirect,
}));

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const suspended = () =>
  jsonResponse(403, {
    data: null,
    error: { code: "ACCOUNT_SUSPENDED", message: "Tài khoản đã bị khoá" },
    meta: { reason: "Vi phạm điều khoản sử dụng", suspended_at: "2026-10-30T08:00:00.000Z" },
  });

const fetchMock = vi.fn();

// `endSuspendedSession` chỉ chuyển trang một lần mỗi lần tải module ⇒ nạp lại client cho từng test.
const loadClient = async () => {
  vi.resetModules();
  return import("./client");
};

describe("authFetch / refreshSession — ACCOUNT_SUSPENDED (FLF-345)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    logoutAndRedirect.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("request giữa phiên dính 403 ⇒ nhớ lý do, đăng xuất về /login; nơi gọi vẫn nhận ApiClientError", async () => {
    const { apiCall, ApiClientError } = await loadClient();
    fetchMock.mockResolvedValue(suspended());

    await expect(apiCall("/users/me")).rejects.toBeInstanceOf(ApiClientError);

    expect(logoutAndRedirect).toHaveBeenCalledWith("/login");
    expect(JSON.parse(sessionStorage.getItem("flintflow:account-suspended") ?? "null")).toEqual({
      reason: "Vi phạm điều khoản sử dụng",
      suspendedAt: "2026-10-30T08:00:00.000Z",
    });
  });

  it("nhiều request cùng dính 403 ⇒ chỉ chuyển trang một lần", async () => {
    const { apiCall } = await loadClient();
    fetchMock.mockImplementation(async () => suspended());

    await Promise.allSettled([apiCall("/a"), apiCall("/b"), apiCall("/c")]);

    expect(logoutAndRedirect).toHaveBeenCalledTimes(1);
  });

  it("refresh bị từ chối vì khoá ⇒ `rejected` và về /login kèm lý do", async () => {
    const { refreshSession } = await loadClient();
    fetchMock.mockResolvedValue(suspended());

    await expect(refreshSession()).resolves.toBe("rejected");

    expect(logoutAndRedirect).toHaveBeenCalledWith("/login");
    expect(sessionStorage.getItem("flintflow:account-suspended")).toContain("Vi phạm điều khoản sử dụng");
  });

  it("403 vì lý do khác (ORG_ROLE_FORBIDDEN) ⇒ không đăng xuất", async () => {
    const { apiCall } = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(403, { data: null, error: { code: "ORG_ROLE_FORBIDDEN", message: "x" } }));

    await expect(apiCall("/orgs/o1/invitations")).rejects.toMatchObject({ code: "ORG_ROLE_FORBIDDEN" });

    expect(logoutAndRedirect).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("flintflow:account-suspended")).toBeNull();
  });
});
