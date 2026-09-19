import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, ApiClientError, apiCall } from "./client";
import { getAccessToken, getStoredAuthToken, saveAuthToken, setAccessToken } from "./token-store";

const makeJwt = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

describe("token-store", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
  });

  it("saveAuthToken lưu token vào bộ nhớ, localStorage và lấy role từ JWT", () => {
    const token = makeJwt({ role: "admin", exp: futureExp() });

    saveAuthToken(token);

    expect(getAccessToken()).toBe(token);
    expect(getStoredAuthToken()).toBe(token);
    expect(localStorage.getItem("userRole")).toBe("admin");
  });
});

describe("apiCall", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gắn Bearer token đã lưu và trả body JSON khi OK", async () => {
    const token = makeJwt({ role: "user", exp: futureExp() });
    saveAuthToken(token);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "p1" }, error: null }));

    const res = await apiCall<{ id: string }>("/projects/p1");

    expect(res.data).toEqual({ id: "p1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/projects/p1`);
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(init.credentials).toBe("include");
  });

  it("ném ApiClientError mang status và code từ BE; message dịch theo mã, câu gốc ở rawMessage (T25)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không thấy" } })
    );

    const promise = apiCall("/projects/missing");

    await expect(promise).rejects.toBeInstanceOf(ApiClientError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      code: "PROJECT_NOT_FOUND",
      message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập.",
      rawMessage: "Không thấy",
    });
  });

  it("mã không có bản dịch (VALIDATION_ERROR mang chi tiết) ⇒ giữ nguyên message BE", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { data: null, error: { code: "VALIDATION_ERROR", message: "name: Too small" } })
    );
    await expect(apiCall("/projects")).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "name: Too small" });
  });

  it("body không phải JSON thì ném PARSE_ERROR", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(apiCall("/projects")).rejects.toMatchObject({ status: 502, code: "PARSE_ERROR" });
  });

  it("không gửi Content-Type JSON khi body là FormData", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: {}, error: null }));

    await apiCall("/projects/p1/documents", { method: "POST", body: new FormData() });

    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  it("gặp 401 thì refresh token rồi thử lại đúng một lần", async () => {
    const oldToken = makeJwt({ role: "user", exp: futureExp() });
    const newToken = makeJwt({ role: "user", exp: futureExp() + 60 });
    saveAuthToken(oldToken);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { data: null, error: { code: "UNAUTHORIZED", message: "x" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: newToken }, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { data: ["ok"], error: null }));

    const res = await apiCall<string[]>("/projects");

    expect(res.data).toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh`);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${newToken}`);
  });
});

describe("refreshSession (FLF-137)", () => {
  const fetchMock = vi.fn();

  // Module có state (refreshPromise, lastRefreshTime) ⇒ mỗi test nạp lại module cho độc lập
  const load = async () => {
    vi.resetModules();
    const client = await import("./client");
    const store = await import("./token-store");
    return { ...client, ...store };
  };

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expiredToken = () => makeJwt({ role: "user", exp: Math.floor(Date.now() / 1000) - 60 });
  const refreshCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));
  const logoutCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"));

  it("BE lỗi 5xx / cold start ⇒ `failed`, giữ token và KHÔNG gọi /auth/logout", async () => {
    const { refreshSession, getStoredAuthToken, saveAuthToken } = await load();
    const token = expiredToken();
    saveAuthToken(token);
    fetchMock.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));

    await expect(refreshSession()).resolves.toBe("failed");

    expect(getStoredAuthToken()).toBe(token);
    expect(logoutCalls()).toHaveLength(0);
  });

  it("lỗi mạng ⇒ `failed`, không đăng xuất", async () => {
    const { refreshSession, getStoredAuthToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(refreshSession()).resolves.toBe("failed");

    expect(getStoredAuthToken()).not.toBeNull();
    expect(logoutCalls()).toHaveLength(0);
  });

  it("BE từ chối (401) ⇒ `rejected`, xoá token", async () => {
    const { refreshSession, getStoredAuthToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { data: null, error: { code: "MISSING_REFRESH_TOKEN", message: "x" } }))
      .mockResolvedValue(jsonResponse(200, { data: null, error: null }));

    await expect(refreshSession()).resolves.toBe("rejected");

    expect(getStoredAuthToken()).toBeNull();
  });

  it("401 vì tab khác vừa xoay vòng refresh token ⇒ dùng token tab kia, không đăng xuất", async () => {
    const { refreshSession, getAccessToken, getStoredAuthToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    const otherTabToken = makeJwt({ role: "user", exp: futureExp() });
    fetchMock.mockImplementationOnce(async () => {
      // Tab khác lưu token mới vào localStorage (dùng chung) trong lúc request của tab này đang bay
      localStorage.setItem("accessToken", otherTabToken);
      return jsonResponse(401, { data: null, error: { code: "CONCURRENT_REFRESH", message: "x" } });
    });

    await expect(refreshSession()).resolves.toBe("ok");

    expect(getStoredAuthToken()).toBe(otherTabToken);
    expect(getAccessToken()).toBe(otherTabToken);
    expect(logoutCalls()).toHaveLength(0);
  });

  it("refresh chạy trong Web Lock dùng chung giữa các tab; tab kia refresh xong trong lúc chờ khoá ⇒ không gọi BE", async () => {
    const { refreshSession, getStoredAuthToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    const otherTabToken = makeJwt({ role: "user", exp: futureExp() });
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
      localStorage.setItem("accessToken", otherTabToken);
      return fn();
    });
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });

    await expect(refreshSession()).resolves.toBe("ok");

    expect(request).toHaveBeenCalledWith("flintflow-auth-refresh", expect.any(Function));
    expect(refreshCalls()).toHaveLength(0);
    expect(getStoredAuthToken()).toBe(otherTabToken);
  });
});
