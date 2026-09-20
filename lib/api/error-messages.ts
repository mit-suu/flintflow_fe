import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * Câu lỗi theo ngôn ngữ cho **mã lỗi của BE** (T25 · P6). BE trả message lẫn tiếng Việt / tiếng Anh; FE dịch
 * theo `error.code` nên cả hai bản đều nhất quán. Mã không có trong `messages/*.json → errors` (mã mơ hồ nhiều
 * nghĩa như `FORBIDDEN`, hay mã mang chi tiết động như `VALIDATION_ERROR`, `OP_INVALID`) giữ nguyên message BE.
 *
 * Gọi ở `ApiClientError` nên mọi chỗ hiện `err.message` (component, hook, runner) tự đúng ngôn ngữ.
 */
const ERRORS: Record<Locale, Record<string, string>> = { vi: vi.errors, en: en.errors };

/**
 * Ngôn ngữ đang hiển thị: `<html lang>` do root layout gắn theo locale của request (đổi theo `router.refresh()`).
 * Admin chỉ tiếng Việt dù cookie là `en` (`app/admin/layout.tsx`) ⇒ trong `/admin` luôn `vi`.
 * Ngoài trình duyệt (SSR, test node) ⇒ `vi`.
 */
export const currentLocale = (): Locale => {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  if (window.location.pathname.startsWith("/admin")) return "vi";
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
};

export const localizeApiError = (code: string | null | undefined, message: string, locale: Locale = currentLocale()): string =>
  (code && ERRORS[locale][code]) || message;
