import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logoutAndRedirect = vi.fn(async () => {});
vi.mock("../auth", () => ({
  clearAuthToken: vi.fn(async () => {}),
  logoutAndRedirect,
}));

const makeJwt = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;

const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const lostOrgForbidden = () =>
  jsonResponse(403, { data: null, error: { code: "ORG_FORBIDDEN", message: "Bạn không thuộc tổ chức này." } });

const noActiveOrg = () =>
  jsonResponse(409, { data: null, error: { code: "NO_ACTIVE_ORG", message: "Bạn chưa chọn tổ chức để làm việc." } });

const orgNotFound = () =>
  jsonResponse(404, { data: null, error: { code: "ORG_NOT_FOUND", message: "Không tìm thấy tổ chức." } });

const fetchMock = vi.fn();
const replaceMock = vi.fn();
const originalLocation = window.location;

const setPathname = (pathname: string) => {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, pathname, replace: replaceMock },
    writable: true,
    configurable: true,
  });
};

const loadClient = async () => {
  vi.resetModules();
  const client = await import("./client");
  const store = await import("./token-store");
  return { ...client, ...store };
};

describe("authFetch - mất quyền truy cập tổ chức (FLF-422)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    logoutAndRedirect.mockClear();
    replaceMock.mockReset();
    fetchMock.mockReset();
    setPathname("/home");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.unstubAllGlobals();
  });

  it("403 ORG_FORBIDDEN khi còn org khác ⇒ refresh cưỡng bức, đọc GET /orgs, chuyển sang /home/organizations và vẫn ném ApiClientError", async () => {
    const { apiCall, ApiClientError, refreshSession, saveAuthToken, getAccessToken } = await loadClient();
    const oldToken = makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() });
    const tokenAfterRecentRefresh = makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() + 30 });
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });

    saveAuthToken(oldToken);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: tokenAfterRecentRefresh }, error: null }));
    expect(await refreshSession()).toBe("ok");

    // Vừa refresh < 2s trước vẫn phải cưỡng bức refresh lại khi gặp 403 ORG_FORBIDDEN
    fetchMock
      .mockResolvedValueOnce(lostOrgForbidden())
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [{ id: "org-b", name: "Nhóm B", role: "analyst", joinedAt: "2026-10-01T00:00:00Z" }],
          error: null,
        })
      );

    await expect(apiCall("/projects")).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiClientError && err.status === 403 && err.code === "ORG_FORBIDDEN"
    );

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home/organizations"));
    expect(getAccessToken()).toBe(refreshedWithoutOrg);
    const orgsCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/orgs"));
    expect(orgsCall?.[1]?.headers?.Authorization).toBe(`Bearer ${refreshedWithoutOrg}`);
  });

  it("409 NO_ACTIVE_ORG khi không còn org nào ⇒ chuyển sang /home/onboarding", async () => {
    const { apiCall, ApiClientError, saveAuthToken } = await loadClient();
    const tokenWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() });
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });
    saveAuthToken(tokenWithoutOrg);

    fetchMock
      .mockResolvedValueOnce(noActiveOrg())
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [], error: null }));

    await expect(apiCall("/projects")).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiClientError && err.status === 409 && err.code === "NO_ACTIVE_ORG"
    );

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home/onboarding"));
  });

  it("404 ORG_NOT_FOUND trên /orgs/<activeOrgId>/... ⇒ kích hoạt thu hồi; trên org khác ⇒ không chuyển trang", async () => {
    const first = await loadClient();
    first.saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });

    fetchMock
      .mockResolvedValueOnce(orgNotFound())
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [{ id: "org-b", name: "Nhóm B", role: "lead", joinedAt: "2026-10-01T00:00:00Z" }],
          error: null,
        })
      );

    await expect(first.apiCall("/orgs/org-a/members")).rejects.toMatchObject({ status: 404, code: "ORG_NOT_FOUND" });
    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home/organizations"));

    // Sang lượt độc lập khác: POST /orgs/org-other/switch trả 404 ORG_NOT_FOUND không được kích hoạt thu hồi
    replaceMock.mockReset();
    fetchMock.mockReset();
    const second = await loadClient();
    second.saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    fetchMock.mockResolvedValueOnce(orgNotFound());

    await expect(second.apiCall("/orgs/org-other/switch", { method: "POST" })).rejects.toMatchObject({
      status: 404,
      code: "ORG_NOT_FOUND",
    });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("nhiều request song song cùng dính 403 ORG_FORBIDDEN ⇒ chỉ thu hồi và chuyển trang đúng 1 lần", async () => {
    const { apiCall, saveAuthToken } = await loadClient();
    saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null });
      }
      if (url.endsWith("/orgs")) {
        return jsonResponse(200, { data: [{ id: "org-b", name: "Nhóm B", role: "lead", joinedAt: "2026-10-01T00:00:00Z" }], error: null });
      }
      return lostOrgForbidden();
    });

    await Promise.allSettled([apiCall("/a"), apiCall("/b"), apiCall("/c")]);

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/home/organizations");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/orgs"))).toHaveLength(1);
  });

  it("403 ORG_ROLE_FORBIDDEN ⇒ không thu hồi, không chuyển trang", async () => {
    const { apiCall, saveAuthToken } = await loadClient();
    saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { data: null, error: { code: "ORG_ROLE_FORBIDDEN", message: "x" } })
    );

    await expect(apiCall("/orgs/org-a/invitations")).rejects.toMatchObject({ code: "ORG_ROLE_FORBIDDEN" });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it.each(["/home/organizations", "/home/onboarding"])(
    "đang đứng sẵn ở %s ⇒ không kích hoạt chuyển trang lặp",
    async (pathname) => {
      setPathname(pathname);
      const { apiCall, saveAuthToken } = await loadClient();
      saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
      fetchMock.mockResolvedValueOnce(lostOrgForbidden());

      await expect(apiCall("/projects")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });

      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).not.toHaveBeenCalled();
    }
  );

  it("403 ORG_FORBIDDEN nhưng refresh trả 403 ACCOUNT_SUSPENDED ⇒ nhường luồng khoá tài khoản (/login), không đọc /orgs hay chuyển sang /home/organizations", async () => {
    const { apiCall, saveAuthToken } = await loadClient();
    saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));

    fetchMock
      .mockResolvedValueOnce(lostOrgForbidden())
      .mockResolvedValueOnce(
        jsonResponse(403, {
          data: null,
          error: { code: "ACCOUNT_SUSPENDED", message: "Tài khoản đã bị khoá" },
          meta: { reason: "Vi phạm", suspended_at: "2026-11-01T00:00:00Z" },
        })
      );

    await expect(apiCall("/projects")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });

    await vi.waitFor(() => expect(logoutAndRedirect).toHaveBeenCalledWith("/login"));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/orgs"))).toHaveLength(0);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("403 ORG_FORBIDDEN nhưng GET /orgs trả 403 ACCOUNT_SUSPENDED ⇒ nhường luồng khoá tài khoản, không chuyển đè sang /home/organizations", async () => {
    const { apiCall, saveAuthToken } = await loadClient();
    saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });

    fetchMock
      .mockResolvedValueOnce(lostOrgForbidden())
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null }))
      .mockResolvedValueOnce(
        jsonResponse(403, {
          data: null,
          error: { code: "ACCOUNT_SUSPENDED", message: "Tài khoản đã bị khoá" },
          meta: { reason: "Vi phạm", suspended_at: "2026-11-01T00:00:00Z" },
        })
      );

    await expect(apiCall("/projects")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });

    await vi.waitFor(() => expect(logoutAndRedirect).toHaveBeenCalledWith("/login"));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("403 ORG_FORBIDDEN và GET /orgs gặp lỗi 503 tạm thời ⇒ vẫn chuyển về /home/organizations", async () => {
    const { apiCall, saveAuthToken } = await loadClient();
    saveAuthToken(makeJwt({ userId: "u1", orgId: "org-a", exp: futureExp() }));
    const refreshedWithoutOrg = makeJwt({ userId: "u1", exp: futureExp() + 60 });

    fetchMock
      .mockResolvedValueOnce(lostOrgForbidden())
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: refreshedWithoutOrg }, error: null }))
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));

    await expect(apiCall("/projects")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home/organizations"));
  });
});
