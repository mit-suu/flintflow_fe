import { setAccessToken } from "./api";

export interface JwtPayload {
  userId?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

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

export const saveAuthToken = (token: string, role?: string) => {
  setAccessToken(token);
  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", token);
    document.cookie = `accessToken=${token}; path=/; max-age=259200; SameSite=Lax`;

    // Try to extract role from JWT if not explicitly passed
    const decoded = decodeJwt(token);
    const resolvedRole = role || decoded?.role || "user";

    localStorage.setItem("userRole", resolvedRole);
    document.cookie = `userRole=${resolvedRole}; path=/; max-age=259200; SameSite=Lax`;
  }
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export const clearAuthToken = () => {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRole");
    document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";

    // Call backend logout asynchronously to clear HttpOnly refreshToken cookies
    fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  }
};

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

export const isAuthenticated = (): boolean => {
  const token = getStoredAuthToken();
  if (!token) return false;

  // Check if token is expired
  const decoded = decodeJwt(token);
  if (decoded?.exp) {
    const isExpired = Date.now() >= decoded.exp * 1000;
    if (isExpired) return false;
  }

  return true;
};
