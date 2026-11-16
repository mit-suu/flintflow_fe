import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, ApiClientError, apiCall } from "./client";
import { getAccessToken, saveAuthToken, setAccessToken } from "./token-store";

const makeJwt = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

/** Giả một tab khác vừa refresh: gửi token qua kênh dùng chung, chờ tới khi bộ nhớ tab này nhận được. */
const sendFromOtherTab = async (token: string, readToken: () => string | null) => {
  const otherTab = new BroadcastChannel("flintflow-auth");
  otherTab.postMessage({ type: "token", token });
  await vi.waitFor(() => expect(readToken()).toBe(token));
  otherTab.close();
};

describe("token-store", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
  });

  it("saveAuthToken lưu token vào bộ nhớ (không vào localStorage) và lấy role từ JWT", () => {
    const token = makeJwt({ role: "admin", exp: futureExp() });

    saveAuthToken(token);

    expect(getAccessToken()).toBe(token);
    expect(localStorage.getItem("accessToken")).toBeNull();
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

  it("ném ApiClientError mang status và code từ BE; message dịch theo mã, câu gốc ở rawMessage", async () => {
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
      jsonResponse(400, { data: null, error: { code: "VALIDATION_ERROR", message: "Tên dự án quá ngắn" } })
    );
    await expect(apiCall("/projects")).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "Tên dự án quá ngắn" });
  });

  it("message BE là text kỹ thuật (Zod, tiếng Anh) ⇒ câu chung, câu gốc giữ ở rawMessage (FLF-247)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { data: null, error: { code: "VALIDATION_ERROR", message: "✖ Invalid input → at base_version" } })
    );
    await expect(apiCall("/projects")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      rawMessage: "✖ Invalid input → at base_version",
    });
  });

  it("lỗi mạng (fetch ném TypeError) ⇒ ApiClientError NETWORK_ERROR với câu cho người (FLF-247)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(apiCall("/projects")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
    });
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
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    const token = expiredToken();
    saveAuthToken(token);
    fetchMock.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));

    await expect(refreshSession()).resolves.toBe("failed");

    expect(getAccessToken()).toBe(token);
    expect(logoutCalls()).toHaveLength(0);
  });

  it("lỗi mạng ⇒ `failed`, không đăng xuất", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(refreshSession()).resolves.toBe("failed");

    expect(getAccessToken()).not.toBeNull();
    expect(logoutCalls()).toHaveLength(0);
  });

  it("BE từ chối (401) ⇒ `rejected`, xoá token", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { data: null, error: { code: "MISSING_REFRESH_TOKEN", message: "x" } }))
      .mockResolvedValue(jsonResponse(200, { data: null, error: null }));

    await expect(refreshSession()).resolves.toBe("rejected");

    expect(getAccessToken()).toBeNull();
  });

  it("401 vì tab khác vừa xoay vòng refresh token ⇒ dùng token tab kia, không đăng xuất", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    const otherTabToken = makeJwt({ role: "user", exp: futureExp() });
    fetchMock.mockImplementationOnce(async () => {
      // Tab khác gửi token mới qua BroadcastChannel trong lúc request của tab này đang bay
      await sendFromOtherTab(otherTabToken, getAccessToken);
      return jsonResponse(401, { data: null, error: { code: "CONCURRENT_REFRESH", message: "x" } });
    });

    await expect(refreshSession()).resolves.toBe("ok");

    expect(getAccessToken()).toBe(otherTabToken);
    expect(getAccessToken()).toBe(otherTabToken);
    expect(logoutCalls()).toHaveLength(0);
  });

  it("refresh chạy trong Web Lock dùng chung giữa các tab; tab kia refresh xong trong lúc chờ khoá ⇒ không gọi BE", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    const otherTabToken = makeJwt({ role: "user", exp: futureExp() });
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
      await sendFromOtherTab(otherTabToken, getAccessToken);
      return fn();
    });
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });

    await expect(refreshSession()).resolves.toBe("ok");

    expect(request).toHaveBeenCalledWith("flintflow-auth-refresh", expect.any(Function));
    expect(refreshCalls()).toHaveLength(0);
    expect(getAccessToken()).toBe(otherTabToken);
  });

  it("refreshSession({ force: true }) bỏ qua bộ đệm 2s và không thoát sớm dù tab khác gửi token mới", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    const initial = makeJwt({ role: "user", orgId: "org-a", exp: futureExp() });
    const otherTabToken = makeJwt({ role: "user", orgId: "org-a", exp: futureExp() + 30 });
    const forcedToken = makeJwt({ role: "user", exp: futureExp() + 60 });
    saveAuthToken(initial);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: initial }, error: null }));
    expect(await refreshSession()).toBe("ok");
    expect(refreshCalls()).toHaveLength(1);

    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
      await sendFromOtherTab(otherTabToken, getAccessToken);
      return fn();
    });
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: forcedToken }, error: null }));

    await expect(refreshSession({ force: true })).resolves.toBe("ok");

    expect(refreshCalls()).toHaveLength(2);
    expect(getAccessToken()).toBe(forcedToken);
  });

  it("refreshSession({ force: true }) khi đang có refresh thường chạy dở ⇒ chờ lượt cũ xong rồi mới gọi cưỡng bức, không đè refreshPromise", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(expiredToken());
    const staleToken = makeJwt({ role: "user", orgId: "org-a", exp: futureExp() });
    const freshToken = makeJwt({ role: "user", exp: futureExp() + 60 });

    let resolveFirst: (res: Response) => void = () => undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: freshToken }, error: null }));

    const first = refreshSession();
    const forced = refreshSession({ force: true });

    expect(refreshCalls()).toHaveLength(1);
    resolveFirst(jsonResponse(200, { data: { accessToken: staleToken }, error: null }));

    await expect(first).resolves.toBe("ok");
    await expect(forced).resolves.toBe("ok");
    expect(refreshCalls()).toHaveLength(2);
    expect(getAccessToken()).toBe(freshToken);
  });

  it("refreshSession({ force: true }) dừng với `rejected` nếu refresh đang chạy bị từ chối", async () => {
    const { refreshSession, saveAuthToken } = await load();
    saveAuthToken(expiredToken());

    let resolveFirst: (res: Response) => void = () => undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(jsonResponse(200, { data: null, error: null }));

    const first = refreshSession();
    const forced = refreshSession({ force: true });

    resolveFirst(jsonResponse(401, { data: null, error: { code: "MISSING_REFRESH_TOKEN", message: "x" } }));

    await expect(first).resolves.toBe("rejected");
    await expect(forced).resolves.toBe("rejected");
    expect(refreshCalls()).toHaveLength(1);
  });

  it("nhiều refreshSession({ force: true }) gọi đồng thời ⇒ gộp thành một lượt /auth/refresh", async () => {
    const { refreshSession, getAccessToken, saveAuthToken } = await load();
    saveAuthToken(makeJwt({ role: "user", orgId: "org-a", exp: futureExp() }));
    const freshToken = makeJwt({ role: "user", exp: futureExp() + 60 });

    let resolveRefresh: (res: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefresh = resolve)));

    const p1 = refreshSession({ force: true });
    const p2 = refreshSession({ force: true });

    resolveRefresh(jsonResponse(200, { data: { accessToken: freshToken }, error: null }));

    await expect(p1).resolves.toBe("ok");
    await expect(p2).resolves.toBe("ok");
    expect(refreshCalls()).toHaveLength(1);
    expect(getAccessToken()).toBe(freshToken);
  });
});
