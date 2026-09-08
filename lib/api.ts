import { saveAuthToken, clearAuthToken, getStoredAuthToken, decodeJwt } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export interface ApiResponse<T = unknown> {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code: string; message: string } | null;
}

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let lastRefreshTime = 0;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const refreshAccessToken = async (): Promise<boolean> => {
  // If recently refreshed (within 2s) and stored token is still valid, reuse without re-calling BE
  const now = Date.now();
  if (now - lastRefreshTime < 2000) {
    const current = getStoredAuthToken();
    if (current) {
      const decoded = decodeJwt(current);
      if (!decoded?.exp || Date.now() < decoded.exp * 1000) {
        accessToken = current;
        return true;
      }
    }
  }

  // If a refresh is already in progress, deduplicate by waiting on the same promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        // Only clear auth tokens if explicitly rejected with 401 or 403
        if (res.status === 401 || res.status === 403) {
          clearAuthToken();
        }
        return false;
      }

      let json: ApiResponse<{ accessToken: string }>;
      try {
        json = await res.json();
      } catch {
        return false;
      }

      if (json.data?.accessToken) {
        lastRefreshTime = Date.now();
        saveAuthToken(json.data.accessToken);
        return true;
      }

      clearAuthToken();
      return false;
    } catch (err) {
      console.error("[refreshAccessToken] Network or refresh error:", err);
      // Do not clear auth tokens on network failure to avoid logging out users during blips
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const apiCall = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> => {
  // 1. If an ongoing refresh is running, await it before making new calls
  if (refreshPromise) {
    await refreshPromise;
  }

  // 2. Proactively refresh token if expired or about to expire in <= 15s
  if (typeof window !== "undefined") {
    const stored = getStoredAuthToken();
    if (stored) {
      accessToken = stored;
      if (retry) {
        const decoded = decodeJwt(stored);
        if (decoded?.exp && Date.now() >= (decoded.exp - 15) * 1000) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            accessToken = getStoredAuthToken();
          }
        }
      }
    }
  }

  const tokenBeforeRequest = accessToken;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
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
      accessToken = latestToken;
      return apiCall<T>(endpoint, options, false);
    }

    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiCall<T>(endpoint, options, false);
    }
  }

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

