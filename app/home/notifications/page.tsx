"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, PageSkeleton, Tabs } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import { useNotificationText } from "@/lib/notification-text";
import { formatNotificationTime, type TimeTranslator } from "@/lib/time-ago";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  onNotificationsChanged,
  type AppNotification,
  type NotificationListMeta,
} from "../../../lib/api/notifications";
import { userErrorMessage } from "@/lib/api/error-messages";

type Filter = "all" | "unread";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const t = useTranslations("app.notifications");
  const tc = useTranslations("app.common");
  const tTime = useTranslations("app.time");
  const locale = useLocale() as Locale;
  const notificationText = useNotificationText();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [meta, setMeta] = useState<NotificationListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadFirstPage = async () => {
      try {
        const res = await fetchNotifications({ unread: filter === "unread", page: 1, limit: PAGE_SIZE });
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        // Chuỗi rỗng = "lỗi tải danh sách, không có câu của BE"; dịch lúc render để `t` không phải vào dependency
        // của effect (đổi ngôn ngữ sẽ tải lại cả danh sách).
        if (!cancelled) setError(userErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  // Bell/đánh dấu đã đọc ở nơi khác → tải lại trang đầu
  useEffect(() => onNotificationsChanged(() => setReloadKey((k) => k + 1)), []);

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setLoading(true);
    setFilter(next);
  };

  const loadMore = async () => {
    if (!meta || meta.page >= meta.totalPages) return;
    setLoadingMore(true);
    try {
      const res = await fetchNotifications({ unread: filter === "unread", page: meta.page + 1, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...res.items]);
      setMeta(res.meta);
    } catch (err) {
      setError(userErrorMessage(err, t("loadMoreFailed")));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
      } catch (err) {
        setError(userErrorMessage(err, t("markFailed")));
        return;
      }
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setError(userErrorMessage(err, t("markFailed")));
    }
  };

  const unreadCount = meta?.unreadCount ?? 0;
  const hasMore = meta ? meta.page < meta.totalPages : false;

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              onChange={changeFilter}
            />
            <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={() => void handleMarkAll()}>
              {t("markAll")}
            </Button>
          </div>
        </div>

        {error !== null && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-control bg-error-container px-3 py-2 text-body text-on-error-container"
          >
            <span className="flex-1">{error || t("loadFailed")}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label={tc("dismiss")}
              className="font-bold hover:opacity-75 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Cùng khuôn với danh sách thành viên: mảng nền mờ gom cả cục, mỗi dòng nổi lên khi rê chuột — không
            viền ngoài, không kẻ ngang. Danh sách tự cuộn trong khung nên bộ lọc và nút "Tải thêm" luôn thấy được. */}
        <div
          role="tabpanel"
          id="notifications-panel"
          aria-labelledby={`notifications-tab-${filter}`}
          className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5 max-h-[64dvh] overflow-y-auto"
        >
          {loading ? (
            <PageSkeleton variant="list" label={t("loadingList")} bare />
          ) : items.length === 0 ? (
            <EmptyState icon="bell" title={filter === "unread" ? t("allRead") : t("empty")} />
          ) : (
            items.map((n) => {
              const text = notificationText(n);
              return (
                <div
                  key={n._id}
                  className={`flex gap-3 rounded-control px-4 py-3 transition-colors ${
                    // Chưa đọc đã có nền riêng ⇒ không đổi màu khi rê chuột, nếu không sẽ mất dấu "chưa đọc"
                    n.readAt ? "hover:bg-surface-container-lowest" : "bg-primary-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      n.readAt ? "bg-surface-container-highest" : "bg-primary"
                    }`}
                  />
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
                        <button
                          type="button"
                          onClick={() => void handleOpen(n)}
                          className="text-body font-semibold text-primary hover:underline cursor-pointer"
                        >
                          {t("viewDetail")}
                        </button>
                      )}
                      {!n.readAt && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n._id).catch(() => setError(t("markFailed")))}
                          className="text-body font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                        >
                          {t("markRead")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasMore && !loading && (
          <Button variant="secondary" loading={loadingMore} className="self-center" onClick={() => void loadMore()}>
            {loadingMore ? tc("loading") : tc("loadMore")}
          </Button>
        )}
      </div>
    </>
  );
}
