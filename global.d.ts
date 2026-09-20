import type { Locale } from "@/lib/i18n";
import type messages from "./messages/vi.json";

// `vi.json` là bản chuẩn: key sai hoặc thiếu trong `t()` là lỗi tsc. `en.json` được test parity giữ khớp.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
