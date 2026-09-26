"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageSkeleton from "@/components/ui/PageSkeleton";
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
        if (!cancelled) setError(err instanceof Error ? err.message : "");
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
      setError(err instanceof Error ? err.message : t("loadMoreFailed"));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("markFailed"));
        return;
      }
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("markFailed"));
    }
  };

  const unreadCount = meta?.unreadCount ?? 0;
  const hasMore = meta ? meta.page < meta.totalPages : false;

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8 bg-surface-container-lowest">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">{t("title")}</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFEEF9] text-[11.5px] font-bold text-[#554DB0]">
                {t("unreadCount", { count: unreadCount })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-[#E4E1DC] rounded-control p-0.5">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => changeFilter(f)}
                  className={`px-3.5 py-1.5 rounded-inner text-[12px] font-semibold transition-colors cursor-pointer ${
                    filter === f ? "bg-[#191817] text-white" : "text-[#6B6862] hover:text-[#191817]"
                  }`}
                >
                  {f === "all" ? t("filterAll") : t("filterUnread")}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="px-3.5 py-1.5 rounded-control border border-[#E4E1DC] bg-white text-[12px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
            >
              {t("markAll")}
            </button>
          </div>
        </div>

        {error !== null && (
          <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-control text-xs font-medium">
            <span className="flex-1">{error || t("loadFailed")}</span>
            <button type="button" onClick={() => setError(null)} aria-label={tc("dismiss")} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        <div className="bg-white border border-[#ECEAE5] rounded-card overflow-hidden">
          {loading ? (
            <PageSkeleton variant="list" label={t("loadingList")} bare />
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[#A8A49C]">
              {filter === "unread" ? t("allRead") : t("empty")}
            </div>
          ) : (
            items.map((n) => {
              const text = notificationText(n);
              return (
              <div
                key={n._id}
                className={`flex gap-3 px-5 py-4 border-b border-[#F3F1EE] last:border-b-0 ${n.readAt ? "" : "bg-[#F8F7FF]"}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-[#E4E1DC]" : "bg-[#6A62C4]"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-bold text-[#191817]">{text.title}</span>
                    <span className="text-[11px] text-[#A8A49C] ml-auto shrink-0">
                      {formatNotificationTime(n.createdAt, tTime as TimeTranslator, locale)}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#6B6862] leading-[1.55] mt-0.5">{text.body}</p>
                  <div className="flex gap-3 mt-2">
                    {n.link && (
                      <button
                        type="button"
                        onClick={() => handleOpen(n)}
                        className="text-[12px] font-semibold text-[#6A62C4] hover:underline cursor-pointer"
                      >
                        {t("viewDetail")}
                      </button>
                    )}
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n._id).catch(() => setError(t("markFailed")))}
                        className="text-[12px] font-semibold text-[#6B6862] hover:text-[#191817] cursor-pointer"
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
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="self-center px-5 py-2 rounded-control border border-[#E4E1DC] bg-white text-[12.5px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
          >
            {loadingMore ? tc("loading") : tc("loadMore")}
          </button>
        )}
      </div>
    </>
  );
}
