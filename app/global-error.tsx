"use client";

import { useSyncExternalStore } from "react";
import { NextIntlClientProvider } from "next-intl";
import ErrorScreen, { type ErrorScreenProps } from "@/components/ErrorScreen";
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import "./globals.css";

/** Chỉ mang theo đúng phần chuỗi trang lỗi — provider không cần cả bộ messages. */
const MESSAGES: Record<Locale, { errors: { page: typeof vi.errors.page } }> = {
  vi: { errors: { page: vi.errors.page } },
  en: { errors: { page: en.errors.page } },
};

/** Locale như `i18n/request.ts` chọn ở server: cookie `NEXT_LOCALE` → ngôn ngữ trình duyệt → `vi`. */
const browserLocale = (): Locale => {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return resolveLocale(cookie, navigator.languages?.join(",") || navigator.language);
};

const noopSubscribe = () => () => undefined;

/**
 * Lỗi ngay trong root layout: Next thay cả root layout bằng file này, nên tự dựng `<html><body>`, tự nạp CSS và
 * tự bọc `NextIntlClientProvider` (không còn provider của layout). Server chưa biết cookie ở đây ⇒ dựng bằng `vi`
 * rồi client đọc cookie chuyển đúng ngôn ngữ, không lệch hydrate.
 */
export default function GlobalError(props: ErrorScreenProps) {
  const locale = useSyncExternalStore(noopSubscribe, browserLocale, () => DEFAULT_LOCALE);
  return (
    <html lang={locale} className="light">
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Ho_Chi_Minh">
          <ErrorScreen {...props} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
