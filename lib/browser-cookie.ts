/**
 * Đọc/ghi cookie không nhạy cảm của FE (bản nhớ hiển thị: tổ chức đang mở, tên hồ sơ, sidebar thu gọn). Cookie để server
 * đọc được lúc dựng HTML (`app/home/layout.tsx`); không chứa token hay dữ liệu bí mật.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const readBrowserCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
};

export const writeBrowserCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};

export const clearBrowserCookie = (name: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

/** Giá trị cookie dạng JSON, server (đã giải mã) hay trình duyệt đều đọc được. */
export const parseJsonCookie = (raw: string | null | undefined): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw.startsWith("%") ? decodeURIComponent(raw) : raw);
  } catch {
    return null;
  }
};
