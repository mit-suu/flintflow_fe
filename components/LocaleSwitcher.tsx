"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { getStoredAuthToken } from "@/lib/api/token-store";
import { updateMyLocale } from "@/lib/api/users";
import { LOCALES, persistLocale, type Locale } from "@/lib/i18n";

export { persistLocale };

/**
 * Nút chuyển VI / EN. Đổi cookie rồi `router.refresh()` — server render lại bằng locale mới, URL và vị trí
 * cuộn giữ nguyên.
 *
 * Hình thức theo segmented control của nav landing / mục sidebar dashboard: rãnh xám ấm, mục đang chọn tô
 * `primary-fixed` + chữ `primary`. Phẳng, không viền.
 */
export default function LocaleSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("common.localeSwitcher");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    persistLocale(locale);
    // Đã đăng nhập ⇒ lưu vào tài khoản (email + lần đăng nhập sau theo lựa chọn này). Lỗi mạng không chặn đổi.
    if (getStoredAuthToken()) void updateMyLocale(locale).catch(() => undefined);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      aria-busy={pending}
      className={`inline-flex items-center gap-0.5 rounded-full bg-surface-sidebar p-1 ${className}`}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            aria-label={t(locale)}
            title={t(locale)}
            onClick={() => choose(locale)}
            disabled={pending}
            className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? "bg-primary-fixed font-bold text-primary"
                : "font-semibold text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
