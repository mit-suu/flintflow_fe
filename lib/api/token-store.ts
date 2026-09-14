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

  const localToken = localStorage.getItem("accessToken");
  if (localToken) return localToken;

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
    const role = localStorage.getItem("userRole");
    if (role) return role;

    const match = document.cookie.match(/(?:^|; )userRole=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  return null;
};

export const saveAuthToken = (token: string, role?: string) => {
  setAccessToken(token);
  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", token);
    document.cookie = `accessToken=${token}; path=/; max-age=259200; SameSite=Lax`;

    // Try to extract role from JWT if not explicitly passed, falling back to existing role
    const decoded = decodeJwt(token);
    const existingRole = getUserRole();
    const resolvedRole = role || decoded?.role || existingRole || "user";

    localStorage.setItem("userRole", resolvedRole);
    document.cookie = `userRole=${resolvedRole}; path=/; max-age=259200; SameSite=Lax`;
  }
};
