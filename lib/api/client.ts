import { clearAuthToken } from "../auth";
import { ACCOUNT_SUSPENDED, endSuspendedSession } from "../account-suspended";
import { isLostOrgError, recoverFromLostOrgAccess } from "../org-access-lost";
import { localizeApiError } from "./error-messages";
import { MODE_SWITCH_ERROR_CODES, signalProjectModeMaybeChanged } from "../project-mode-signal";
import { decodeJwt, getAccessToken, getActiveOrgId, saveAuthToken } from "./token-store";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export interface ApiResponse<T = unknown> {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code: string; message: string } | null;
}

/**
 * Lỗi API. `message` đã được dịch theo `code` sang ngôn ngữ đang hiển thị (`localizeApiError`); câu gốc của BE
 * giữ ở `rawMessage` để log / debug.
 */
export class ApiClientError extends Error {
  code: string;
  status: number;
  rawMessage: string;
  /** `meta` của envelope lỗi (vd `issues[]` của `IMPORT_FILE_REJECTED`, `prefill` của `CHANGE_REQUIRES_CR`). */
  meta?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, meta?: Record<string, unknown>) {
    super(localizeApiError(code, message, undefined, meta));
    this.status = status;
    this.code = code;
    this.rawMessage = message;
    this.meta = meta;
    // FLF-318: lỗi chỉ dự án mode 1 có ⇒ dự án có thể vừa được chuyển sang mode 1, workspace đọc lại project
    if (MODE_SWITCH_ERROR_CODES.has(code)) signalProjectModeMaybeChanged();
  }
}

/**
 * Kết quả refresh:
 * - `ok`: đã có access token hợp lệ.
 * - `rejected`: BE từ chối refresh token (401/403) — phiên thật sự hết, đã xoá token.
 * - `failed`: lỗi mạng / BE 5xx / cold start — phiên có thể vẫn còn, KHÔNG được đăng xuất.
 */
export type RefreshOutcome = "ok" | "rejected" | "failed";

const REFRESH_LOCK_NAME = "flintflow-auth-refresh";

let refreshPromise: Promise<RefreshOutcome> | null = null;
let refreshForced = false;
let lastRefreshTime = 0;

const isTokenFresh = (token: string | null): token is string => {
  if (!token) return false;
  const decoded = decodeJwt(token);
  return !decoded?.exp || Date.now() < decoded.exp * 1000;
};

/**
 * Tab khác đã refresh xong trong lúc tab này chờ/gọi BE ⇒ token trong bộ nhớ (tab kia gửi sang qua
 * `BroadcastChannel`) đã khác token lúc bắt đầu và còn hạn. Dùng luôn token đó thay vì gọi BE bằng refresh
 * token cũ đã bị xoay vòng.
 */
const adoptTokenRefreshedElsewhere = (tokenAtStart: string | null): boolean => {
  const current = getAccessToken();
  return !!current && current !== tokenAtStart && isTokenFresh(current);
};

/** Gọi `fn` trong khoá dùng chung giữa các tab (Web Locks); trình duyệt không hỗ trợ thì chạy thẳng. */
const withCrossTabLock = <T>(fn: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, fn) as Promise<T>;
  }
  return fn();
};

const readJsonClone = async (res: Response): Promise<ApiResponse | null> => {
  try {
    return (await res.clone().json()) as ApiResponse;
  } catch {
    return null;
  }
};

/**
 * 403 `ACCOUNT_SUSPENDED` (FLF-345): tài khoản bị khoá giữa phiên ⇒ đăng xuất, về /login kèm lý do khoá.
 * Đọc trên bản clone để nơi gọi vẫn đọc được body của `res`.
 */
const isSuspendedResponse = async (res: Response): Promise<boolean> => {
  if (res.status !== 403) return false;
  const body = await readJsonClone(res);
  if (body?.error?.code !== ACCOUNT_SUSPENDED) return false;
  endSuspendedSession(body.meta);
  return true;
};

/** Đọc số org còn lại bằng token vừa refresh (gọi `fetch` trực tiếp để tránh vòng import với `orgs.ts`). */
const fetchOrgsCount = async (): Promise<number | null> => {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/orgs`, {
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    if (await isSuspendedResponse(res)) return null;
    throw new Error(`HTTP ${res.status}`);
  }

  const json = (await res.json()) as ApiResponse<unknown[]>;
  if (!Array.isArray(json.data)) {
    throw new Error("INVALID_ORGS_RESPONSE");
  }
  return json.data.length;
};

/**
 * 403 `ORG_FORBIDDEN`, 409 `NO_ACTIVE_ORG`, hoặc 404 `ORG_NOT_FOUND` trên `/orgs/<activeOrgId>`:
 * phiên đang giữ `orgId` không còn quyền ⇒ thu hồi và đưa về chọn tổ chức / onboarding.
 * Đọc trên bản clone để nơi gọi vẫn nhận nguyên `Response` và ném `ApiClientError` chuẩn.
 */
const isOrgAccessLostResponse = async (
  res: Response,
  endpoint: string,
  activeOrgId: string | null
): Promise<boolean> => {
  if (res.status !== 403 && res.status !== 409 && res.status !== 404) return false;
  const body = await readJsonClone(res);
  if (!isLostOrgError(res.status, body?.error?.code, endpoint, activeOrgId)) return false;
  void recoverFromLostOrgAccess({
    refresh: () => refreshSession({ force: true }),
    fetchOrgsCount,
  });
  return true;
};

const requestRefresh = async (tokenAtStart: string | null, force = false): Promise<RefreshOutcome> => {
  if (!force && adoptTokenRefreshedElsewhere(tokenAtStart)) return "ok";

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Tab khác (không có Web Locks) có thể đã xoay vòng refresh token ngay trước request này —
        // khi đó đăng xuất sẽ gọi /auth/logout với cookie MỚI và thu hồi luôn phiên vừa tạo.
        if (adoptTokenRefreshedElsewhere(tokenAtStart)) return "ok";
        if (await isSuspendedResponse(res)) return "rejected";
        clearAuthToken();
        return "rejected";
      }
      return "failed";
    }

    let json: ApiResponse<{ accessToken: string }>;
    try {
      json = await res.json();
    } catch {
      return "failed";
    }

    if (json.data?.accessToken) {
      lastRefreshTime = Date.now();
      saveAuthToken(json.data.accessToken);
      return "ok";
    }

    clearAuthToken();
    return "rejected";
  } catch (err) {
    console.error("[refreshAccessToken] Network or refresh error:", err);
    // Do not clear auth tokens on network failure to avoid logging out users during blips
    return "failed";
  }
};

export const refreshSession = async (options?: { force?: boolean }): Promise<RefreshOutcome> => {
  const force = Boolean(options?.force);

  // If recently refreshed (within 2s) and the in-memory token is still valid, reuse without re-calling BE
  if (!force && Date.now() - lastRefreshTime < 2000 && isTokenFresh(getAccessToken())) {
    return "ok";
  }

  // If a refresh is already in progress, share it when non-forced or already forced; otherwise wait for it
  // to settle before issuing a forced refresh so we neither reuse a stale-org token nor race /auth/refresh.
  while (refreshPromise) {
    if (!force || refreshForced) return refreshPromise;
    const outcome = await refreshPromise;
    if (outcome === "rejected") return "rejected";
  }

  const tokenAtStart = getAccessToken();
  refreshForced = force;
  refreshPromise = withCrossTabLock(() => requestRefresh(tokenAtStart, force)).finally(() => {
    refreshPromise = null;
    refreshForced = false;
  });

  return refreshPromise;
};

export const refreshAccessToken = async (): Promise<boolean> => (await refreshSession()) === "ok";

/** Ngưỡng refresh chủ động mặc định cho một request ngắn. */
export const DEFAULT_MIN_TOKEN_TTL_MS = 15_000;

/**
 * Một lượt chạy step kéo dài 30 giây tới vài phút; access token sống 15 phút. Mở stream lúc token còn
 * dưới ngần này thì nó hết hạn GIỮA luồng và không refresh được nữa (BUG-18) — nên refresh trước khi mở.
 */
export const STREAM_MIN_TOKEN_TTL_MS = 120_000;

/** Bảo đảm access token còn ít nhất `minTtlMs` nữa; hết hạn tới nơi thì refresh trước. */
export const ensureFreshToken = async (minTtlMs: number = DEFAULT_MIN_TOKEN_TTL_MS): Promise<void> => {
  if (typeof window === "undefined") return;
  if (refreshPromise) await refreshPromise;
  const current = getAccessToken();
  if (!current) return;
  const decoded = decodeJwt(current);
  if (decoded?.exp && Date.now() >= decoded.exp * 1000 - minTtlMs) {
    await refreshAccessToken();
  }
};

/**
 * `fetch` tới BE có gắn Bearer token: refresh chủ động khi token sắp hết hạn,
 * thử lại đúng một lần khi gặp 401. Trả `Response` thô để dùng cho JSON, SSE hoặc file.
 */
export const authFetch = async (
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> => {
  // 1. If an ongoing refresh is running, await it before making new calls
  if (refreshPromise) {
    await refreshPromise;
  }

  // 2. Proactively refresh token if expired or about to expire in <= 15s
  if (typeof window !== "undefined" && retry) {
    const current = getAccessToken();
    const decoded = current ? decodeJwt(current) : null;
    if (decoded?.exp && Date.now() >= (decoded.exp - 15) * 1000) {
      await refreshAccessToken();
    }
  }

  const tokenBeforeRequest = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (tokenBeforeRequest) {
    headers["Authorization"] = `Bearer ${tokenBeforeRequest}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err) {
    // Huỷ (AbortError) giữ nguyên để nơi gọi im lặng; còn lại là lỗi mạng — "Failed to fetch" không phải câu cho user
    if ((err as { name?: unknown } | null)?.name === "AbortError") throw err;
    throw new ApiClientError(0, "NETWORK_ERROR", err instanceof Error ? err.message : String(err));
  }

  if (!(await isSuspendedResponse(res))) {
    const activeOrgId = (tokenBeforeRequest ? decodeJwt(tokenBeforeRequest)?.orgId : null) ?? getActiveOrgId();
    await isOrgAccessLostResponse(res, endpoint, activeOrgId);
  }

  // 3. Handle 401 Unauthorized with concurrency awareness
  if (res.status === 401 && retry) {
    // If another concurrent request has already refreshed the token in the meantime,
    // retry immediately with the fresh token rather than initiating a redundant refresh
    const latestToken = getAccessToken();
    if (latestToken && latestToken !== tokenBeforeRequest) {
      return authFetch(endpoint, options, false);
    }

    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return authFetch(endpoint, options, false);
    }
  }

  return res;
};

/**
 * Câu lỗi **gốc** của BE (chưa dịch) — dùng khi còn dựng tiếp `ApiClientError`, vì constructor của nó tự dịch
 * theo mã; đọc bản đã dịch ở đây sẽ làm mất câu gốc trong `rawMessage`.
 */
export const readRawErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const errJson = await res.json();
    return errJson.error?.message || errJson.message || fallback;
  } catch {
    return fallback;
  }
};

/** Đọc thông điệp lỗi từ body JSON của response không OK, đã dịch theo mã (dùng cho SSE/file ném `Error` thường). */
export const readErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const errJson = await res.json();
    return localizeApiError(errJson.error?.code, errJson.error?.message || errJson.message || fallback);
  } catch {
    return fallback;
  }
};

export const apiCall = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> => {
  const res = await authFetch(endpoint, options, retry);

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    json = {
      data: null,
      error: {
        code: "PARSE_ERROR",
        message: `HTTP ${res.status}: Server returned non-JSON response`,
      },
    };
  }

  if (!res.ok || json.error) {
    throw new ApiClientError(
      res.status,
      json.error?.code || "UNKNOWN_ERROR",
      json.error?.message || `HTTP ${res.status}`,
      json.meta
    );
  }

  return json;
};
