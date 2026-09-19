/**
 * Token store — nơi duy nhất giữ access token (bộ nhớ + localStorage/cookie).
 * Module lá: không import gì trong `lib/` để `client.ts` và `auth.ts` cùng dùng mà không tạo vòng import.
 */

export interface JwtPayload {
  userId?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

let accessToken: string | null = null;

/**
 * Chế độ "Ghi nhớ tài khoản" (chọn ở trang đăng nhập), lưu ở localStorage để các lần refresh sau biết
 * nơi cất token:
 * - bền (mặc định): localStorage + cookie 30 ngày — đóng trình duyệt vẫn còn đăng nhập;
 * - `"session"`: sessionStorage + cookie phiên — đóng trình duyệt là mất (khớp cookie phiên của BE).
 */
const PERSISTENCE_KEY = "authPersistence";
const PERSISTENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const isPersistentSession = (): boolean => localStorage.getItem(PERSISTENCE_KEY) !== "session";

export const setSessionPersistence = (persistent: boolean) => {
  if (typeof window === "undefined") return;
  if (persistent) localStorage.removeItem(PERSISTENCE_KEY);
  else localStorage.setItem(PERSISTENCE_KEY, "session");
};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    let jsonStr: string;
    if (typeof atob === "function") {
      jsonStr = decodeURIComponent(
        atob(base64Payload)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else {
      jsonStr = Buffer.from(base64Payload, "base64").toString("utf-8");
    }

    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export const getStoredAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;

  const storedToken = localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");
  if (storedToken) return storedToken;

  const match = document.cookie.match(/(?:^|; )accessToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const getUserRole = (): string | null => {
  const token = getStoredAuthToken();
  if (token) {
    const decoded = decodeJwt(token);
    if (decoded?.role) return decoded.role;
  }

  if (typeof window !== "undefined") {
    const role = localStorage.getItem("userRole") ?? sessionStorage.getItem("userRole");
    if (role) return role;

    const match = document.cookie.match(/(?:^|; )userRole=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  return null;
};

/**
 * Lưu access token. `options.persistent` chỉ truyền lúc vừa đăng nhập (đổi chế độ ghi nhớ); các lần
 * refresh sau không truyền ⇒ giữ chế độ đã chọn.
 */
export const saveAuthToken = (token: string, role?: string, options?: { persistent?: boolean }) => {
  setAccessToken(token);
  if (typeof window !== "undefined") {
    if (options?.persistent !== undefined) setSessionPersistence(options.persistent);
    const persistent = isPersistentSession();
    const store = persistent ? localStorage : sessionStorage;
    const staleStore = persistent ? sessionStorage : localStorage;
    // Không có max-age ⇒ cookie phiên, trình duyệt xoá khi đóng
    const cookieLifetime = persistent ? `; max-age=${PERSISTENT_COOKIE_MAX_AGE}` : "";

    // Try to extract role from JWT if not explicitly passed, falling back to existing role
    const decoded = decodeJwt(token);
    const existingRole = getUserRole();
    const resolvedRole = role || decoded?.role || existingRole || "user";

    staleStore.removeItem("accessToken");
    staleStore.removeItem("userRole");
    store.setItem("accessToken", token);
    store.setItem("userRole", resolvedRole);
    document.cookie = `accessToken=${token}; path=/${cookieLifetime}; SameSite=Lax`;
    document.cookie = `userRole=${resolvedRole}; path=/${cookieLifetime}; SameSite=Lax`;
  }
};
