import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * Câu lỗi theo ngôn ngữ cho **mã lỗi của BE** (T25 · P6). BE trả message lẫn tiếng Việt / tiếng Anh; FE dịch
 * theo `error.code` nên cả hai bản đều nhất quán. Mã không có trong `messages/*.json → errors` (mã mơ hồ nhiều
 * nghĩa như `FORBIDDEN`, hay mã mang chi tiết động như `VALIDATION_ERROR`) giữ nguyên message BE — trừ khi câu đó
 * trông như text kỹ thuật (`looksTechnical`), khi đó thay bằng câu chung (FLF-247).
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

/** Dấu hiệu câu là của máy chứ không phải của người: mã lỗi, đường dẫn op, dump Zod/JSON, lỗi JS/mạng/Mongo. */
const TECHNICAL_PATTERNS: readonly RegExp[] = [
  /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/, // STEP_NOT_RUNNABLE, OPENAI_API_KEY
  /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/, // base_version, section_empty, authorized_role_ids
  /\bHTTP \d{3}\b/,
  /\w\[\w+=/, // actors[id=A03]
  /\$new\d/,
  /[✖→]/, // z.prettifyError
  /^\s*[[{]/, // JSON
  /\b(?:undefined|NaN|TypeError|SyntaxError|ReferenceError|Zod|ObjectId|E11000|ECONN\w*|ETIMEDOUT|finish_reason|max_tokens|stack trace)\b/,
  /Cannot read propert|is not a function|Unexpected token|Failed to fetch|NetworkError|Load failed|status code \d|non-JSON|not valid JSON/i,
];

/** Có chữ cái riêng của tiếng Việt — câu tiếng Việt không dấu gần như không có trong message của BE. */
const VIETNAMESE_LETTER = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Câu có nên hiện thẳng cho user không. Rỗng, mang dấu hiệu kỹ thuật, hoặc (đang xem tiếng Việt) là câu tiếng Anh
 * thuần của BE/thư viện ⇒ `true` — thay bằng câu chung.
 */
export const looksTechnical = (message: string | null | undefined, locale: Locale = currentLocale()): boolean => {
  const text = (message ?? "").trim();
  if (!text) return true;
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return locale === "vi" && /[a-z]{3,}\s+[a-z]{3,}/i.test(text) && !VIETNAMESE_LETTER.test(text);
};

/** Câu chung khi không có câu nào hiện được cho user. */
export const genericErrorMessage = (locale: Locale = currentLocale()): string => ERRORS[locale].UNKNOWN_ERROR;

/**
 * Mã FE tự gán khi envelope của BE không có mã (`apiCall`, SSE, tải file…). Câu BE kèm theo (nếu là câu cho người)
 * cụ thể hơn câu dịch của mã ⇒ ưu tiên câu BE; câu dịch của mã chỉ thay cho text kỹ thuật như `HTTP 502`.
 */
const FALLBACK_CODES: ReadonlySet<string> = new Set(["UNKNOWN_ERROR", "PARSE_ERROR", "STREAM_FAILED", "EXPORT_FAILED", "DOWNLOAD_FAILED", "DIAGRAM_FETCH_FAILED"]);

export const localizeApiError = (code: string | null | undefined, message: string, locale: Locale = currentLocale()): string => {
  const mapped = code ? ERRORS[locale][code] : undefined;
  if (mapped && !(code && FALLBACK_CODES.has(code))) return mapped;
  return looksTechnical(message, locale) ? mapped || genericErrorMessage(locale) : message;
};

/**
 * Câu lỗi hiện cho user từ một lỗi bất kỳ (FLF-247). `ApiClientError` đã dịch sẵn (`message`); lỗi FE tự ném bằng
 * câu tiếng Việt giữ nguyên; lỗi mạng (`TypeError: Failed to fetch`), lỗi JSON, lỗi JS hay `String(err)` ⇒ `fallback`
 * (hoặc câu chung) — không bao giờ lộ text kỹ thuật.
 */
export const userErrorMessage = (err: unknown, fallback?: string, locale: Locale = currentLocale()): string => {
  const message = err instanceof Error ? err.message : "";
  if (err instanceof TypeError && /fetch|network|load failed/i.test(message)) return ERRORS[locale].NETWORK_ERROR;
  // Câu chung (lỗi API đã bị lọc vì kỹ thuật) kém hơn câu dự phòng riêng của chỗ gọi ("Không tải được danh sách cờ")
  if (message && message !== genericErrorMessage(locale) && !looksTechnical(message, locale)) return message;
  return fallback || genericErrorMessage(locale);
};
