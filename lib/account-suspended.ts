/**
 * UC-03 (FLF-345): tài khoản bị Administrator khoá. BE trả 403 `ACCOUNT_SUSPENDED` kèm `meta { reason, suspended_at }`
 * ở mọi đường bị chặn (đăng nhập, Google, refresh, request giữa phiên). Màn đăng nhập hiện lý do + ngày khoá.
 *
 * Bị khoá giữa phiên ⇒ đăng xuất về /login; thông báo đi qua `sessionStorage` (chỉ tab này, đọc một lần),
 * không đặt lý do lên URL.
 */
import { logoutAndRedirect } from "./auth";

export const ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";

export interface SuspensionNotice {
  reason: string | null;
  suspendedAt: string | null;
}

const STORAGE_KEY = "flintflow:account-suspended";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export const suspensionFromMeta = (meta: Record<string, unknown> | null | undefined): SuspensionNotice => ({
  reason: text(meta?.reason),
  suspendedAt: text(meta?.suspended_at),
});

export const rememberSuspension = (notice: SuspensionNotice): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notice));
  } catch {
    // storage bị chặn ⇒ màn đăng nhập chỉ không có lý do, vẫn đăng xuất bình thường
  }
};

/** Đọc rồi xoá — tải lại /login lần sau không hiện lại thông báo cũ. */
export const takeSuspension = (): SuspensionNotice | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return suspensionFromMeta(JSON.parse(raw));
  } catch {
    return null;
  }
};

let ending = false;

/** Bị khoá giữa phiên: nhớ lý do, đăng xuất, về /login. Nhiều request cùng dính 403 thì chỉ chuyển trang một lần. */
export const endSuspendedSession = (meta: Record<string, unknown> | null | undefined): void => {
  if (typeof window === "undefined" || ending) return;
  rememberSuspension(suspensionFromMeta(meta));
  if (window.location.pathname.startsWith("/login")) return;
  ending = true;
  void logoutAndRedirect("/login");
};
