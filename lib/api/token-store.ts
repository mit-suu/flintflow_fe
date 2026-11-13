/**
 * Token store — nơi duy nhất giữ access token. Token **chỉ nằm trong bộ nhớ**: không localStorage, sessionStorage
 * hay cookie đọc được bằng JS, để một lỗi XSS không lấy được token cất sẵn. Tải lại trang / mở tab mới thì lấy
 * token mới qua `/auth/refresh` (cookie refresh `httpOnly` do BE đặt) — AuthGuard làm việc đó.
 * Các tab đồng bộ token với nhau qua `BroadcastChannel` (truyền thẳng giữa các tab, không ghi xuống đĩa).
 * Module lá: không import gì trong `lib/` để `client.ts` và `auth.ts` cùng dùng mà không tạo vòng import.
 */

export interface JwtPayload {
  userId?: string;
  email?: string;
  role?: string;
  /** Org đang mở (task-26). Không có ⇒ tài khoản chưa vào org nào, BE trả 409 NO_ACTIVE_ORG. */
  orgId?: string;
  exp?: number;
  iat?: number;
}

let accessToken: string | null = null;

type AuthMessage = { type: "token"; token: string } | { type: "clear" };

const AUTH_CHANNEL_NAME = "flintflow-auth";

/** Kênh giữa các tab. Tab nhận tin chỉ cập nhật bộ nhớ của nó, không phát lại (không vòng lặp). */
const authChannel: BroadcastChannel | null = (() => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<AuthMessage>) => {
    accessToken = event.data?.type === "token" ? event.data.token : null;
  };
  // Node (vitest) giữ tiến trình sống khi còn kênh mở; trình duyệt không có `unref`
  (channel as { unref?: () => void }).unref?.();
  return channel;
})();

const broadcast = (message: AuthMessage) => authChannel?.postMessage(message);

/** Token mà bản cũ cất ở storage / cookie FE: xoá để không còn nằm lại trên máy. JS không đụng được tới cookie `httpOnly` của BE. */
const purgeLegacyToken = () => {
  localStorage.removeItem("accessToken");
  sessionStorage.removeItem("accessToken");
  document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
};

/**
 * Chế độ "Ghi nhớ tài khoản" (chọn ở trang đăng nhập), lưu ở localStorage để các lần refresh sau biết
 * nơi cất `userRole` (không bí mật; `proxy.ts` đọc cookie này để biết có phiên):
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

/** Xoá token trong bộ nhớ của mọi tab (đăng xuất). */
export const clearAccessToken = () => {
  accessToken = null;
  broadcast({ type: "clear" });
};

/**
 * Org đang mở, đọc từ claim trong access token. Không gọi API: đây đúng là thứ BE dùng để quyết định
 * `409 NO_ACTIVE_ORG`, nên đọc cùng một nguồn thì không bao giờ lệch.
 */
export const getActiveOrgId = (): string | null => {
  const token = getAccessToken();
  return (token ? decodeJwt(token)?.orgId : null) ?? null;
};

/**
 * Có phiên đăng nhập không, kể cả khi tab vừa mở chưa kịp refresh lấy token vào bộ nhớ: dựa vào `userRole`
 * (không bí mật) lưu cùng lúc đăng nhập và xoá lúc đăng xuất.
 */
export const hasSession = (): boolean => getUserRole() !== null;

export const getUserRole = (): string | null => {
  const token = getAccessToken();
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
 * Lưu access token vào bộ nhớ (và gửi cho các tab khác). `options.persistent` chỉ truyền lúc vừa đăng nhập
 * (đổi chế độ ghi nhớ); các lần refresh sau không truyền ⇒ giữ chế độ đã chọn.
 */
export const saveAuthToken = (token: string, role?: string, options?: { persistent?: boolean }) => {
  setAccessToken(token);
  broadcast({ type: "token", token });
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

    purgeLegacyToken();
    staleStore.removeItem("userRole");
    store.setItem("userRole", resolvedRole);
    document.cookie = `userRole=${resolvedRole}; path=/${cookieLifetime}; SameSite=Lax`;
  }
};
