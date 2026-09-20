import { render, renderHook, type RenderHookOptions, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

export const MESSAGES = { vi, en } as const;

/** Chữ cái có dấu chỉ tiếng Việt mới có — bản en còn ký tự nào như vậy là còn chuỗi chưa dịch. */
export const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Chuỗi tiếng Việt còn sót trong một cây DOM: chữ hiển thị + `aria-label` / `placeholder` / `title` / `alt`.
 * Bỏ qua phần tử tự khai `lang` (nút "Tiếng Việt" của LocaleSwitcher).
 */
export const vietnameseLeftovers = (root: HTMLElement): string[] => {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[lang]").forEach((el) => el.remove());
  const names = ["aria-label", "placeholder", "title", "alt"];
  const attrs = [...clone.querySelectorAll(names.map((n) => `[${n}]`).join(","))].flatMap((el) =>
    names.map((a) => el.getAttribute(a)).filter((v): v is string => Boolean(v))
  );
  return [clone.textContent ?? "", ...attrs].filter((s) => VIETNAMESE.test(s));
};

const intlWrapper = (locale: Locale) =>
  function IntlWrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Ho_Chi_Minh">
        {children}
      </NextIntlClientProvider>
    );
  };

/**
 * `render` bọc `NextIntlClientProvider` — component dùng `useTranslations` cần provider như trong app.
 * Bọc qua `wrapper` nên `rerender` vẫn giữ provider.
 */
export const renderWithIntl = (ui: ReactElement, locale: Locale = "vi", options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { ...options, wrapper: intlWrapper(locale) });

/** `renderHook` với provider — cho hook gọi `useTranslations`. */
export const renderHookWithIntl = <Result, Props>(
  hook: (props: Props) => Result,
  locale: Locale = "vi",
  options?: Omit<RenderHookOptions<Props>, "wrapper">
) => renderHook(hook, { ...options, wrapper: intlWrapper(locale) });
