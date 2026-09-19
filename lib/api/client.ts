import { clearAuthToken } from "../auth";
import { localizeApiError } from "./error-messages";
import {
  decodeJwt,
  getAccessToken,
  getStoredAuthToken,
  saveAuthToken,
  setAccessToken,
} from "./token-store";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export interface ApiResponse<T = unknown> {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code: string; message: string } | null;
}

/**
 * Lỗi API. `message` đã được dịch theo `code` sang ngôn ngữ đang hiển thị (`localizeApiError`, T25); câu gốc
 * của BE giữ ở `rawMessage` để log / debug.
 */
export class ApiClientError extends Error {
  code: string;
  status: number;
  rawMessage: string;

  constructor(status: number, code: string, message: string) {
    super(localizeApiError(code, message));
    this.status = status;
    this.code = code;
    this.rawMessage = message;
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
let lastRefreshTime = 0;

const isTokenFresh = (token: string | null): token is string => {
  if (!token) return false;
  const decoded = decodeJwt(token);
  return !decoded?.exp || Date.now() < decoded.exp * 1000;
};

/**
 * Tab khác đã refresh xong trong lúc tab này chờ/gọi BE ⇒ token trong localStorage (dùng chung giữa các tab)
 * đã khác token lúc bắt đầu và còn hạn. Dùng luôn token đó thay vì gọi BE bằng refresh token cũ đã bị xoay vòng.
 */
const adoptTokenRefreshedElsewhere = (tokenAtStart: string | null): boolean => {
  const current = getStoredAuthToken();
  if (current && current !== tokenAtStart && isTokenFresh(current)) {
    setAccessToken(current);
    return true;
  }
  return false;
};

/** Gọi `fn` trong khoá dùng chung giữa các tab (Web Locks); trình duyệt không hỗ trợ thì chạy thẳng. */
const withCrossTabLock = <T>(fn: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, fn) as Promise<T>;
  }
  return fn();
};

const requestRefresh = async (tokenAtStart: string | null): Promise<RefreshOutcome> => {
  if (adoptTokenRefreshedElsewhere(tokenAtStart)) return "ok";

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

export const refreshSession = async (): Promise<RefreshOutcome> => {
  // If recently refreshed (within 2s) and stored token is still valid, reuse without re-calling BE
  if (Date.now() - lastRefreshTime < 2000) {
    const current = getStoredAuthToken();
    if (isTokenFresh(current)) {
      setAccessToken(current);
      return "ok";
    }
  }

  // If a refresh is already in progress, deduplicate by waiting on the same promise
  if (refreshPromise) {
    return refreshPromise;
  }

  const tokenAtStart = getStoredAuthToken();
  refreshPromise = withCrossTabLock(() => requestRefresh(tokenAtStart)).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

export const refreshAccessToken = async (): Promise<boolean> => (await refreshSession()) === "ok";

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
  if (typeof window !== "undefined") {
    const stored = getStoredAuthToken();
    if (stored) {
      setAccessToken(stored);
      if (retry) {
        const decoded = decodeJwt(stored);
        if (decoded?.exp && Date.now() >= (decoded.exp - 15) * 1000) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            setAccessToken(getStoredAuthToken());
          }
        }
      }
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

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // 3. Handle 401 Unauthorized with concurrency awareness
  if (res.status === 401 && retry) {
    // If another concurrent request has already refreshed the token in the meantime,
    // retry immediately with the fresh token rather than initiating a redundant refresh
    const latestToken = getStoredAuthToken();
    if (latestToken && latestToken !== tokenBeforeRequest) {
      setAccessToken(latestToken);
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

/** Đọc thông điệp lỗi từ body JSON của response không OK, đã dịch theo mã (dùng cho SSE ném `Error` thường). */
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
      json.error?.message || `HTTP ${res.status}`
    );
  }

  return json;
};
