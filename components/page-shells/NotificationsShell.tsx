"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, DataListSkeleton, PAGE_GUTTER, Skeleton, STICKY_BLEED, STICKY_FADE, Tabs } from "@/components/ui";

export type NotificationFilter = "all" | "unread";

/**
 * Khung trang Thông báo: vùng cuộn, tiêu đề + số chưa đọc, tab lọc, nút "Đọc tất cả". Trang thật (`app/home/notifications`)
 * và khung chờ đăng nhập (`ShellSkeleton`) cùng dựng từ đây ⇒ lúc tải lại, hình khung chờ trùng hẳn trang đang tải.
 */
export default function NotificationsShell({
  scrollRef,
  unreadCount,
  filter,
  onFilterChange,
  onMarkAll,
  alert,
  children,
}: {
  scrollRef?: (el: HTMLDivElement | null) => void;
  unreadCount: number;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  onMarkAll: () => void;
  /** Thanh báo lỗi phía trên danh sách. */
  alert?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("app.notifications");
  return (
    // Vùng cuộn không có padding trên: `sticky top-0` tính từ mép trong của padding — đệm trên nằm ở khối bên trong
    <div ref={scrollRef} className={`flex-1 overflow-y-auto overflow-x-hidden pb-scroll-end bg-surface-container-lowest ${PAGE_GUTTER}`}>
      <div className="w-full max-w-[1200px] mx-auto pt-6 sm:pt-8 flex flex-col gap-3">
        {/* Tiêu đề + bộ lọc dính ở đầu vùng cuộn — danh sách dài cuộn qua bên dưới */}
        <div
          className={`sticky top-0 z-30 py-3 -mt-3 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${STICKY_BLEED} ${STICKY_FADE}`}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
            {unreadCount > 0 && (
              <Badge tone="primary" size="md">
                {t("unreadCount", { count: unreadCount })}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tabs
              label={t("title")}
              idBase="notifications"
              value={filter}
              options={[
                { value: "all", label: t("filterAll") },
                { value: "unread", label: t("filterUnread") },
              ]}
              onChange={onFilterChange}
            />
            <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={onMarkAll}>
              {t("markAll")}
            </Button>
          </div>
        </div>

        {alert}

        <div role="tabpanel" id="notifications-panel" aria-labelledby={`notifications-tab-${filter}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Dòng giữ chỗ cùng hình dòng thông báo thật: chấm trạng thái, tiêu đề + giờ, hai dòng nội dung, dòng thao tác. */
export function NotificationRowSkeleton() {
  return (
    <div className="flex gap-3 px-1">
      <span aria-hidden className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-surface-container-highest" />
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-56 max-w-full" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3.5 w-24 mt-1" />
      </div>
    </div>
  );
}

/** Số dòng giữ chỗ lúc tải lần đầu — trang thật và khung chờ dùng chung. */
export const NOTIFICATION_SKELETON_ROWS = 6;

const noop = () => undefined;

/** Trang Thông báo lúc đang tải lần đầu, dùng cho khung chờ đăng nhập. */
export function NotificationsLoading() {
  const t = useTranslations("app.notifications");
  return (
    <NotificationsShell unreadCount={0} filter="all" onFilterChange={noop} onMarkAll={noop}>
      <DataListSkeleton rows={NOTIFICATION_SKELETON_ROWS} label={t("loadingList")} renderSkeletonRow={NotificationRowSkeleton} />
    </NotificationsShell>
  );
}
