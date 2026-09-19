import { decodeJwt, getStoredAuthToken, setAccessToken } from "./api/token-store";

// Hàm token nằm ở `lib/api/token-store.ts`; re-export để giữ đường import cũ `lib/auth`.
export { decodeJwt, getStoredAuthToken, getUserRole, saveAuthToken, setSessionPersistence } from "./api/token-store";
export type { JwtPayload } from "./api/token-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const LOGOUT_TIMEOUT_MS = 3000;

// Cookie accessToken/refreshToken do BE đặt là HttpOnly: JS không xoá được, chỉ /auth/logout xoá được.
// `keepalive` để request không bị huỷ khi trang chuyển đi; có timeout để BE chết không treo nút đăng xuất.
const logoutOnServer = (): Promise<void> => {
  const request = fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).then(
    () => undefined,
    () => undefined
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_TIMEOUT_MS));
  return Promise.race([request, timeout]);
};

export const clearAuthToken = (): Promise<void> => {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRole");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userRole");
    document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";

    return logoutOnServer();
  }
  return Promise.resolve();
};

/**
 * Đăng xuất rồi về trang đăng nhập. Phải chờ BE xoá cookie HttpOnly trước khi chuyển trang: nếu không,
 * `proxy.ts` còn thấy accessToken hợp lệ và đẩy /login ngược về /home, AuthGuard kẹt ở spinner.
 * Dùng reload đầy đủ thay vì router để không dính lần redirect /login → /home đã nằm trong router cache.
 */
export const logoutAndRedirect = async (to = "/login"): Promise<void> => {
  await clearAuthToken();
  window.location.replace(to);
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

const REMEMBERED_EMAIL_KEY = "rememberedEmail";

/** Email đã lưu khi tick "Ghi nhớ tài khoản" ở lần đăng nhập trước (để điền sẵn). */
export const getRememberedEmail = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY);
  } catch {
    return null;
  }
};

export const setRememberedEmail = (email: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư…) ⇒ bỏ qua, chỉ mất tính năng điền sẵn
  }
};
