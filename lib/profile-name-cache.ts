import { clearBrowserCookie, parseJsonCookie, readBrowserCookie, writeBrowserCookie } from "./browser-cookie";

/**
 * Bản nhớ tên hồ sơ của người đang đăng nhập. Token chỉ có email, tên thật phải đợi `GET /users/me`; trước đây khung lấy
 * phần trước `@` của email làm tên tạm nên avatar hiện chữ đoán (vd "Q" từ quynhfe99) rồi đổi sang chữ thật ("N").
 * Có bản nhớ thì avatar và tên ở menu tài khoản đúng ngay từ khung đầu; chưa có thì avatar là logo FlintFlow.
 * Kèm `userId` để không lấy nhầm tên người khác trên cùng máy; đăng xuất thì xoá.
 */
export const PROFILE_NAME_COOKIE = "ff_profile";

export interface RememberedProfile {
  userId: string;
  name: string;
}

export const parseProfileNameCookie = (raw: string | null | undefined): RememberedProfile | null => {
  const value = parseJsonCookie(raw) as Partial<RememberedProfile> | null;
  if (!value || typeof value.userId !== "string" || typeof value.name !== "string" || !value.name.trim()) return null;
  return { userId: value.userId, name: value.name };
};

/** Tên đã nhớ của `userId` (chỉ ở trình duyệt); khác người hay chưa nhớ ⇒ `null`. */
export const readProfileName = (userId: string | null | undefined): string | null => {
  const profile = parseProfileNameCookie(readBrowserCookie(PROFILE_NAME_COOKIE));
  return profile && userId && profile.userId === userId ? profile.name : null;
};

export const writeProfileName = (profile: RememberedProfile) => writeBrowserCookie(PROFILE_NAME_COOKIE, JSON.stringify(profile));

export const clearProfileName = () => clearBrowserCookie(PROFILE_NAME_COOKIE);
