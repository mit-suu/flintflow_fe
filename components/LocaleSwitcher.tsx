"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { getStoredAuthToken } from "@/lib/api/token-store";
import { patchMe } from "@/lib/api/users";
import { LOCALES, persistLocale, type Locale } from "@/lib/i18n";

export { persistLocale };

/**
 * Nút chuyển VI / EN. Đổi cookie rồi `router.refresh()` — server render lại bằng locale mới, URL và vị trí
 * cuộn giữ nguyên. `tone`: `dark` cho nền tối (landing), `light` cho nền sáng (auth, app).
 */
const TONES = {
  dark: {
    frame: "border-white/[0.08]",
    active: "bg-white/[0.08] text-[#FAFAFA]",
    idle: "text-zinc-500 hover:text-zinc-300",
  },
  light: {
    frame: "border-[#E4E1DC] bg-white",
    active: "bg-[#F4F3FE] text-[#4F46E5]",
    idle: "text-[#8A867E] hover:text-[#191817]",
  },
} as const;

export default function LocaleSwitcher({
  tone = "dark",
  className = "",
}: {
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const t = useTranslations("common.localeSwitcher");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const styles = TONES[tone];

  const choose = (locale: Locale) => {
    if (locale === current) return;
    persistLocale(locale);
    // Đã đăng nhập ⇒ lưu vào tài khoản (email + lần đăng nhập sau theo lựa chọn này). Lỗi mạng không chặn đổi.
    if (getStoredAuthToken()) void patchMe({ locale }).catch(() => undefined);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      aria-busy={pending}
      className={`inline-flex items-center rounded-md border p-0.5 font-mono text-[11px] ${styles.frame} ${className}`}
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
            className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
              active ? styles.active : styles.idle
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
