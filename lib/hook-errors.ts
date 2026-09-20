/**
 * Lỗi do hook FE tự sinh khi BE không kèm message. Hook không gọi `useTranslations`: lỗi được ghi trong
 * callback mà `useEffect` gọi — đưa `t` vào dependency sẽ tải lại dữ liệu mỗi lần đổi ngôn ngữ, và test
 * `renderHook` không có provider. Nên hook lưu mã `@<key>`; component dịch lúc render bằng `hookErrorText`
 * với `useTranslations("workspace.hookErrors")`. Lỗi có message từ BE đi qua nguyên văn.
 */
export const HOOK_ERROR = {
  docLoadFailed: "@docLoadFailed",
  spineNotReady: "@spineNotReady",
  docConflict: "@docConflict",
  assembleFailed: "@assembleFailed",
  flagsLoadFailed: "@flagsLoadFailed",
  waiveFailed: "@waiveFailed",
  recomputeFailed: "@recomputeFailed",
  actionFailed: "@actionFailed",
  spineLoadFailed: "@spineLoadFailed",
  progressLoadFailed: "@progressLoadFailed",
} as const;

export type HookErrorKey = keyof typeof HOOK_ERROR;

const isHookErrorKey = (key: string): key is HookErrorKey => key in HOOK_ERROR;

export const hookErrorText = (error: string, t: (key: HookErrorKey) => string): string => {
  const key = error.startsWith("@") ? error.slice(1) : "";
  return isHookErrorKey(key) ? t(key) : error;
};
