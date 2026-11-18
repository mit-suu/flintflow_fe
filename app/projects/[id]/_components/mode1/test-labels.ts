/** Chỉ cho test: `Mode1Labels` dựng ngoài React bằng `createTranslator` (component thật dùng `useMode1Labels()`). */
import { createTranslator } from "next-intl";
import type { Locale } from "@/lib/i18n";
import { MESSAGES } from "@/test/intl";
import { mode1Labels, type Mode1T } from "./i18n";

export const labelsFor = (locale: Locale = "vi") =>
  mode1Labels(createTranslator({ locale, messages: MESSAGES[locale], namespace: "mode1" }) as unknown as Mode1T, locale);
