import type { Locale } from "./i18n";

/**
 * Hàm dịch của namespace `app.time` — truyền `useTranslations("app.time")` vào. Hai hàm dưới đây giữ nguyên
 * được tính thuần (test không cần provider) trong khi chữ vẫn theo ngôn ngữ.
 */
export type TimeTranslator = (
  key: "justNow" | "minutesAgo" | "hoursAgo" | "yesterday" | "daysAgo" | "weeksAgo",
  values?: { count: number }
) => string;

/** Thông báo: "Vừa xong" / "x phút trước" / "x giờ trước", quá một ngày thì hiện ngày. */
export function formatNotificationTime(iso: string, t: TimeTranslator, locale: Locale, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
}

/** Thẻ dự án: phút → giờ → hôm qua → ngày → tuần. */
export function timeAgo(dateStr: string, t: TimeTranslator, now = Date.now()): string {
  const seconds = Math.floor((now - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return t("minutesAgo", { count: Math.max(1, Math.floor(seconds / 60)) });
  if (seconds < 86400) return t("hoursAgo", { count: Math.floor(seconds / 3600) });
  if (seconds < 172800) return t("yesterday");
  if (seconds < 604800) return t("daysAgo", { count: Math.floor(seconds / 86400) });
  return t("weeksAgo", { count: Math.floor(seconds / 604800) });
}
