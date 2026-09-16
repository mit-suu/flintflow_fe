/**
 * i18n cho nhãn quy trình.
 *
 * Nguồn duy nhất là **step registry** (`lib/constants/step-registry.json`, bản sao đồng bộ từ BE) —
 * mỗi step đã mang sẵn `label_vi` và `label_en`, nên không có bảng dịch chép tay thứ hai để lệch nhau.
 *
 * Phạm vi cố ý hẹp: chỉ dịch **nhãn step và phase**. Chuỗi UI còn lại vẫn viết thẳng tiếng Việt trong
 * component — dựng cả một framework i18n cho một sản phẩm đang dùng một ngôn ngữ là chi phí không đổi
 * lấy được gì. Khi thật sự cần ngôn ngữ thứ hai cho toàn UI thì thay chỗ này bằng thư viện, chữ ký `t()`
 * giữ nguyên.
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
export const localeOf = (user?: { locale?: string | null } | null): Locale =>
  LOCALES.includes(user?.locale as Locale) ? (user?.locale as Locale) : DEFAULT_LOCALE;
