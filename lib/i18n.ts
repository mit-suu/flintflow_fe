/**
 * i18n cho nhãn quy trình.
 *
 * Nguồn duy nhất là **step registry** (`lib/constants/step-registry.json`, bản sao đồng bộ từ BE) —
 * mỗi step đã mang sẵn `label_vi` và `label_en`, nên không có bảng dịch chép tay thứ hai để lệch nhau.
 *
 * Chuỗi UI còn lại đi qua `next-intl` (`messages/<locale>.json`, cấu hình ở `i18n/request.ts`) — T25 chuyển
 * dần từng khu vực, khu vực chưa chuyển vẫn viết thẳng tiếng Việt. File này là nguồn chung của danh sách
 * locale và cách chọn locale cho cả hai đường.
 *
 * Nội dung tài liệu SRS luôn là tiếng Anh (do BE sinh) và **không** đi qua đây.
 */

import {
  NONSCREEN_LOOP,
  PHASE_LABELS_VI,
  getStepDef,
  parseStepId,
  type PhaseId,
} from "./constants/step-registry";

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Cookie lưu lựa chọn ngôn ngữ — tên mặc định của next-intl. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Ghi lựa chọn vào cookie để server đọc ở request sau (`i18n/request.ts`). Chỉ gọi ở client. */
export const persistLocale = (locale: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
};

/**
 * Sau khi đăng nhập: ngôn ngữ đã lưu trong tài khoản (`user.locale` từ BE) thắng cookie hiện tại. Giá trị lạ /
 * thiếu (BE cũ) ⇒ không làm gì.
 */
export const applyAccountLocale = (value: unknown) => {
  if (isLocale(value)) persistLocale(value);
};

/**
 * Locale của một request: cookie `NEXT_LOCALE` → header `Accept-Language` (theo trọng số `q`) → `vi`.
 * Chỉ so phần ngôn ngữ chính: `en-US` ⇒ `en`, `vi-VN` ⇒ `vi`.
 */
export const resolveLocale = (cookie?: string | null, acceptLanguage?: string | null): Locale => {
  if (isLocale(cookie)) return cookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.split("-")[0].toLowerCase(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.lang && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  const match = ranked.find((entry) => isLocale(entry.lang));
  return match ? (match.lang as Locale) : DEFAULT_LOCALE;
};

/** Nhãn phase tiếng Anh lấy từ chính registry (`phase_label_en`) để khỏi chép tay. */
const phaseLabelEn = (phase: PhaseId): string => {
  const def = getStepDef(`${phase}.1`) ?? getStepDef(`${phase}.1@${NONSCREEN_LOOP}`);
  return def?.phase_label_en ?? phase;
};

const LOOP_SUFFIX: Record<Locale, { nonscreen: string }> = {
  vi: { nonscreen: "không màn hình" },
  en: { nonscreen: "non-screen" },
};

/**
 * Nhãn của một step theo ngôn ngữ. Step của vòng S-5 kèm khoá vòng:
 * `Chi tiết chức năng · S07` / `Function Details · S07`.
 * Step không có trong registry trả về chính id — hiện sai còn hơn hiện rỗng.
 */
export const tStep = (stepId: string, locale: Locale = DEFAULT_LOCALE): string => {
  const def = getStepDef(stepId);
  if (!def) return stepId;
  const base = locale === "en" ? def.label_en : def.label_vi;
  if (!def.loop) return base;
  const loop = def.loop === NONSCREEN_LOOP ? LOOP_SUFFIX[locale].nonscreen : def.loop;
  return `${base} · ${loop}`;
};

/** Nhãn phase theo ngôn ngữ (`B-1` → "Product Brief"). */
export const tPhase = (phase: string, locale: Locale = DEFAULT_LOCALE): string => {
  const id = phase as PhaseId;
  if (locale === "en") return phaseLabelEn(id);
  return PHASE_LABELS_VI[id] ?? phase;
};

/** `S-5.2@S07` → nhãn phase của nó. Dùng khi chỉ có step id trong tay. */
export const tPhaseOfStep = (stepId: string, locale: Locale = DEFAULT_LOCALE): string => {
  const def = getStepDef(stepId);
  return def ? tPhase(def.phase, locale) : tPhase(parseStepId(stepId).base.split(".")[0], locale);
};

/**
 * Ngôn ngữ UI: `user.locale` khi có, mặc định tiếng Việt.
 *
 * BE **chưa có** field `locale` trên user (`GET /users/me`), nên hiện tại hàm này luôn trả `vi`. Giữ ở
 * đây để khi BE thêm field thì chỉ cần truyền user vào, không phải đi sửa từng component.
 */
export const localeOf = (user?: { locale?: string | null } | null): Locale => {
  const locale = user?.locale;
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
};
