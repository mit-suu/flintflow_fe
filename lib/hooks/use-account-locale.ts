"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateMyLocale } from "@/lib/api/users";
import { applyAccountLocale, DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { User } from "@/types/user";

/**
 * Đã xử lý ngôn ngữ tài khoản trong lần tải trang này — đồng bộ xong, hoặc user vừa tự chọn ở `LocaleSwitcher`.
 * Biến cấp module chứ không phải state: `router.refresh()`, remount hay StrictMode đều không chạy lại, nên không thể
 * thành vòng lặp refresh (kể cả khi trình duyệt chặn cookie). Tải lại trang thì về `false`.
 */
let settled = false;

/** `LocaleSwitcher` gọi khi user tự chọn: lựa chọn vừa bấm thắng giá trị tài khoản đọc lúc mount. */
export const markAccountLocaleSettled = (): void => {
  settled = true;
};

/** Chỉ cho test. */
export const resetAccountLocaleSync = (): void => {
  settled = false;
};

/**
 * FLF-259 — lần đầu có hồ sơ (`GET /users/me`) trong một lần tải trang:
 * - tài khoản đã chọn ngôn ngữ ⇒ ghi cookie; khác ngôn ngữ đang hiển thị thì `router.refresh()` để server render lại;
 * - tài khoản chưa chọn ⇒ lưu ngôn ngữ đang hiển thị vào tài khoản, không chặn giao diện, lỗi thì ghi console.
 */
export const useAccountLocaleSync = (account: Pick<User, "locale"> | null): void => {
  const current = useLocale();
  const rendered = isLocale(current) ? current : DEFAULT_LOCALE;
  const router = useRouter();

  useEffect(() => {
    if (!account || settled) return;
    settled = true;
    const applied = applyAccountLocale(account.locale);
    if (applied) {
      if (applied !== rendered) router.refresh();
      return;
    }
    void updateMyLocale(rendered).catch((err: unknown) => {
      console.error("[useAccountLocaleSync] Failed to save the current locale to the account:", err);
    });
  }, [account, rendered, router]);
};
