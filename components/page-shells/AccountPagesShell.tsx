"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ONBOARDING_PATH } from "@/components/OrgGuard";
import { Icon, LINK_PRIMARY, PageSkeleton } from "@/components/ui";

/**
 * Khung của hai trang tài khoản nhỏ — Hồ sơ (`/home/profile`) và Tổ chức của bạn (`/home/organizations`) — dùng chung với
 * khung chờ đăng nhập (`ShellSkeleton`) ⇒ lúc tải lại, khung chờ trùng hẳn trang đang tải (tiêu đề, nút vẽ thật).
 */

/** Vùng cuộn của trang Hồ sơ / Tổ chức. */
export const ACCOUNT_PAGE_SCROLL_CLASS = "flex-1 overflow-y-auto flex flex-col gap-6 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest";

/** Trang Hồ sơ lúc đang tải. */
export function ProfileLoading() {
  const t = useTranslations("app.profile");
  return (
    <div className={ACCOUNT_PAGE_SCROLL_CLASS}>
      <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
      <PageSkeleton variant="form" label={t("loading")} />
    </div>
  );
}

/** Tiêu đề + mô tả + nút "Thêm tổ chức" của trang Tổ chức (ẩn nút khi chắc chắn chưa thuộc tổ chức nào). */
export function OrganizationsHeader({ showAdd }: { showAdd: boolean }) {
  const t = useTranslations("app.org.switcher");
  return (
    // Hành động chính của trang nằm cạnh tiêu đề, cùng khuôn với trang Thành viên
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
        <p className="text-body text-on-surface-muted leading-[1.6]">{t("subtitle")}</p>
      </div>
      {showAdd && (
        <Link href={ONBOARDING_PATH} className={LINK_PRIMARY}>
          <Icon name="plus" size={16} />
          {t("addCta")}
        </Link>
      )}
    </div>
  );
}

/** Trang Tổ chức lúc đang tải (trong khung app, khi đã có tổ chức đang mở). */
export function OrganizationsLoading() {
  const t = useTranslations("app.org.switcher");
  return (
    <div className={ACCOUNT_PAGE_SCROLL_CLASS}>
      <div className="w-full max-w-[720px] mx-auto flex flex-col gap-6">
        <OrganizationsHeader showAdd />
        <PageSkeleton variant="list" label={t("loading")} />
      </div>
    </div>
  );
}
