"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, InfiniteDataList, PAGE_GUTTER, STICKY_BLEED, STICKY_FADE, Tabs } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import { useNotificationText } from "@/lib/notification-text";
import { formatNotificationTime, type TimeTranslator } from "@/lib/time-ago";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  onNotificationsChanged,
  type AppNotification,
} from "@/lib/api/notifications";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";

type Filter = "all" | "unread";

const PAGE_SIZE = 20;

/**
 * Trang Thông báo: danh sách **tải dần khi cuộn** (`useInfiniteList` + `InfiniteDataList`, FLF-404), thanh lọc dính ở đầu vùng
 * cuộn. Đánh dấu một mục đã đọc ngay trên trang ⇒ sửa tại chỗ (không tải lại, giữ các trang đã nối); thay đổi từ nơi khác
 * (chuông, đọc tất cả) ⇒ tải lại từ trang 1.
 */
export default function NotificationsPage() {
  const t = useTranslations("app.notifications");
  const tc = useTranslations("app.common");
  const tTime = useTranslations("app.time");
  const locale = useLocale() as Locale;
  const notificationText = useNotificationText();
  const router = useRouter();
  /** Vùng cuộn của trang — gốc để dò "đã cuộn gần cuối". State (không phải ref) để đọc được lúc render. */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Đang đánh dấu một mục ngay trên trang — sự kiện "đã đổi" do chính lần gọi đó phát ra thì không tải lại. */
  const ownChange = useRef(false);

  const list = useInfiniteList<AppNotification>({
    key: filter,
    root: scrollEl,
    fetchPage: async (page) => {
      const res = await fetchNotifications({ unread: filter === "unread", page, limit: PAGE_SIZE });
      setUnreadCount(res.meta.unreadCount ?? 0);
      return res;
    },
  });
  const { reload, updateItems } = list;

  // Bell / đánh dấu ở nơi khác ⇒ tải lại; tự đánh dấu một mục ⇒ chỉ cập nhật số chưa đọc
  useEffect(
    () =>
      onNotificationsChanged(() => {
        if (!ownChange.current) reload();
        fetchUnreadCount()
          .then(setUnreadCount)
          .catch(() => undefined);
      }),
    [reload],
  );

  const markOne = async (notification: AppNotification) => {
    ownChange.current = true;
    try {
      await markNotificationRead(notification._id);
    } finally {
      ownChange.current = false;
    }
    const readAt = new Date().toISOString();
    updateItems((n) => (n._id === notification._id && !n.readAt ? { ...n, readAt } : n));
  };

  const handleMarkOne = async (notification: AppNotification) => {
    try {
      await markOne(notification);
    } catch (err) {
      setActionError(userErrorMessage(err, t("markFailed")));
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markOne(notification);
      } catch (err) {
        setActionError(userErrorMessage(err, t("markFailed")));
        return;
      }
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setActionError(userErrorMessage(err, t("markFailed")));
    }
  };

  // Chuỗi rỗng từ `userErrorMessage` = không có câu của BE ⇒ câu chung
  const loadError = list.error ? userErrorMessage(list.error) || t("loadFailed") : null;
  const error = actionError ?? loadError;

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      {/* Vùng cuộn không có padding trên: `sticky top-0` tính từ mép trong của padding — đệm trên nằm ở khối bên trong */}
      <div ref={setScrollEl} className={`flex-1 overflow-y-auto overflow-x-hidden pb-scroll-end bg-surface-container-lowest ${PAGE_GUTTER}`}>
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
                onChange={setFilter}
              />
              <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={() => void handleMarkAll()}>
                {t("markAll")}
              </Button>
            </div>
          </div>

          {error !== null && (
            <div role="alert" className="flex items-center gap-3 rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              <span className="flex-1">{error}</span>
              {actionError !== null && (
                <button type="button" onClick={() => setActionError(null)} aria-label={tc("dismiss")} className="font-bold hover:opacity-75 cursor-pointer">
                  ✕
                </button>
              )}
            </div>
          )}

          <div role="tabpanel" id="notifications-panel" aria-labelledby={`notifications-tab-${filter}`}>
            <InfiniteDataList
              list={list}
              getKey={(n) => n._id}
              loadingLabel={t("loadingList")}
              // Chưa đọc có nền riêng, giữ nguyên khi rê chuột — nếu không sẽ mất dấu "chưa đọc"
              rowClassName={(n) => `flex gap-3 !px-4 ${n.readAt ? "" : "!bg-primary-soft"}`}
              empty={
                !list.error && (
                  <EmptyState icon="bell" title={filter === "unread" ? t("allRead") : t("empty")} className="rounded-card bg-surface-container-low" />
                )
              }
              renderItem={(n) => {
                const text = notificationText(n);
                return (
                  <>
                    <span aria-hidden className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-surface-container-highest" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-body font-bold text-on-surface">{text.title}</span>
                        <span className="text-caption text-on-surface-subtle ml-auto shrink-0">
                          {formatNotificationTime(n.createdAt, tTime as TimeTranslator, locale)}
                        </span>
                      </div>
                      <p className="text-body text-on-surface-variant leading-[1.55] mt-0.5">{text.body}</p>
                      <div className="flex gap-3 mt-2">
                        {n.link && (
                          <button type="button" onClick={() => void handleOpen(n)} className="text-body font-semibold text-primary hover:underline cursor-pointer">
                            {t("viewDetail")}
                          </button>
                        )}
                        {!n.readAt && (
                          <button
                            type="button"
                            onClick={() => void handleMarkOne(n)}
                            className="text-body font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                          >
                            {t("markRead")}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                );
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
