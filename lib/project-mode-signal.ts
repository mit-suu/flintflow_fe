/**
 * FLF-318: Lead chốt baseline dự án tạo SRS ⇒ BE chuyển dự án sang `mode = import`. Workspace chỉ đọc `mode` lúc mở
 * trang, nên các chỗ có thể vừa làm đổi mode (duyệt baseline, Accept S-9.5) hoặc gặp lỗi chỉ có ở mode 1 phát tín hiệu
 * này; trang workspace nghe và đọc lại project để đổi sang workspace mode 1 mà không cần tải lại trang.
 */

export const PROJECT_MODE_EVENT = "flintflow:project-mode-maybe-changed";

/** Lỗi BE chỉ trả cho dự án mode 1 — gặp ở workspace mode 2 nghĩa là dự án vừa được chuyển. */
export const MODE_SWITCH_ERROR_CODES: ReadonlySet<string> = new Set(["MODE1_NO_STEPS", "CHANGE_REQUIRES_CR", "PROJECT_MODE_MISMATCH"]);

export const signalProjectModeMaybeChanged = (): void => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROJECT_MODE_EVENT));
};

/** Đăng ký nghe; trả hàm huỷ (dùng thẳng làm cleanup của `useEffect`). */
export const onProjectModeMaybeChanged = (listener: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROJECT_MODE_EVENT, listener);
  return () => window.removeEventListener(PROJECT_MODE_EVENT, listener);
};
