import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";

/**
 * Cấu hình next-intl cho mỗi request (T25). **Không** prefix locale trong URL: locale lấy từ cookie
 * `NEXT_LOCALE` (do `LocaleSwitcher` ghi), không có thì theo `Accept-Language`, cuối cùng là `vi`.
 * Đổi sang prefix URL (`/en/...`) là quyết định khác hẳn — xem `claude_plan/task-25-i18n-ui.md` #2.
 *
 * Nơi gọi xin locale cụ thể (`getMessages({ locale: "vi" })` ở `app/admin/layout.tsx`) thì phải tôn trọng nó —
 * bỏ qua là admin nhận nhầm bản `en` khi cookie là `en`.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = isLocale(requested)
    ? requested
    : resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));

  return {
    locale,
    // Người dùng ở Việt Nam; cố định để ngày giờ render server và client không lệch nhau.
    timeZone: "Asia/Ho_Chi_Minh",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
