"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { getStoredAuthToken } from "@/lib/api/token-store";
import { updateMyLocale } from "@/lib/api/users";
import { LOCALES, persistLocale, type Locale } from "@/lib/i18n";

export { persistLocale };

/**
 * Chặn trên cho lúc chờ `router.refresh()` bên trong một view transition. Trong lúc transition chạy, trình
 * duyệt hiển thị ảnh chụp và đóng băng trang — mạng chậm mà chờ vô hạn thì trang như treo. Hết hạn này thì
 * cứ cross-fade, chữ mới hiện ngay sau đó.
 */
const REFRESH_TIMEOUT_MS = 800;

type WithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Nút chuyển VI / EN. Đổi cookie rồi `router.refresh()` — server render lại bằng locale mới, URL và vị trí
 * cuộn giữ nguyên.
 *
 * `router.refresh()` tráo cả cây server component trong một nhịp nên chữ nhảy thẳng sang ngôn ngữ mới, nhìn
 * ra thành một cú nháy. Bọc trong `document.startViewTransition()`: trình duyệt chụp trang trước và sau khi
 * tráo rồi **cross-fade** giữa hai ảnh — bản cũ mờ đi, bản mới hiện lên (thời lượng ở `app/globals.css`).
 * Trình duyệt không có API này thì chạy thẳng như cũ; bật "giảm chuyển động" thì CSS tắt phần động.
 *
 * Hình thức theo segmented control của nav landing / mục sidebar dashboard: rãnh xám ấm, mục đang chọn tô
 * `primary-fixed` + chữ `primary`. Phẳng, không viền.
 */
export default function LocaleSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("common.localeSwitcher");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /** Kết thúc lần chờ hiện tại — gọi khi `router.refresh()` đã commit xong cây mới. */
  const settleRefresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (pending) return;
    settleRefresh.current?.();
    settleRefresh.current = null;
  }, [pending]);

  const choose = (locale: Locale) => {
    if (locale === current) return;
    persistLocale(locale);
    // Đã đăng nhập ⇒ lưu vào tài khoản (email + lần đăng nhập sau theo lựa chọn này). Lỗi mạng không chặn đổi.
    if (getStoredAuthToken()) void updateMyLocale(locale).catch(() => undefined);

    const refresh = () => startTransition(() => router.refresh());
    const startViewTransition = (document as WithViewTransition).startViewTransition;
    if (!startViewTransition) {
      refresh();
      return;
    }

    // Ảnh chụp "sau" chỉ đúng khi cây mới đã lên màn hình ⇒ giữ promise tới lúc `pending` về false.
    startViewTransition.call(document, () => {
      refresh();
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, REFRESH_TIMEOUT_MS);
        settleRefresh.current = () => {
          window.clearTimeout(timer);
          resolve();
        };
      });
    });
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
