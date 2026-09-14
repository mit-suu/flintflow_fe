import { decodeJwt, getStoredAuthToken, setAccessToken } from "./api/token-store";

// Hàm token nằm ở `lib/api/token-store.ts`; re-export để giữ đường import cũ `lib/auth`.
export { decodeJwt, getStoredAuthToken, getUserRole, saveAuthToken } from "./api/token-store";
export type { JwtPayload } from "./api/token-store";

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
