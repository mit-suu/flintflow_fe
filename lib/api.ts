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

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

const refreshAccessToken = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        const json: ApiResponse<{ accessToken: string }> = await res.json();
        if (res.ok && json.data?.accessToken) {
          accessToken = json.data.accessToken;
          return true;
        }
        accessToken = null;
        return false;
      } catch {
        accessToken = null;
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
};

export const apiCall = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiCall<T>(endpoint, options, false);
    }
  }

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || json.error) {
    throw new ApiClientError(
      res.status,
      json.error?.code || "UNKNOWN_ERROR",
      json.error?.message || `HTTP ${res.status}`
    );
  }

  return json;
};
