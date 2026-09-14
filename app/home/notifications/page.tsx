"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationBell, { formatNotificationTime } from "../../../components/NotificationBell";
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải thông báo");
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
      setError(err instanceof Error ? err.message : "Không thể tải thêm thông báo");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể đánh dấu đã đọc");
        return;
      }
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đánh dấu đã đọc");
    }
  };

  const unreadCount = meta?.unreadCount ?? 0;
  const hasMore = meta ? meta.page < meta.totalPages : false;

  return (
    <>
      <div className="h-[58px] bg-white border-b border-[#E4E1DC] flex items-center px-6 gap-3.5 shrink-0 z-10">
        <div className="flex items-center gap-1.5 text-[13px] text-[#8A867E]">
          <span>Tài khoản</span>
          <span className="text-[#D6D2CB]">/</span>
          <span className="text-[#191817] font-bold">Thông báo</span>
        </div>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8 bg-[#F5F3F0]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Thông báo</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#EEEDFD] text-[11.5px] font-bold text-[#3B34B0]">
                {unreadCount} chưa đọc
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-[#E4E1DC] rounded-full p-0.5">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => changeFilter(f)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                    filter === f ? "bg-[#191817] text-white" : "text-[#6B6862] hover:text-[#191817]"
                  }`}
                >
                  {f === "all" ? "Tất cả" : "Chưa đọc"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="px-3.5 py-1.5 rounded-full border border-[#E4E1DC] bg-white text-[12px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-xs font-medium">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#A8A49C] gap-3">
              <span className="w-5 h-5 rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
              <span className="text-[13px] font-medium">Đang tải thông báo…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[#A8A49C]">
              {filter === "unread" ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo nào"}
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n._id}
                className={`flex gap-3 px-5 py-4 border-b border-[#F3F1EE] last:border-b-0 ${n.readAt ? "" : "bg-[#F8F7FF]"}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-[#E4E1DC]" : "bg-[#4F46E5]"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-bold text-[#191817]">{n.title}</span>
                    <span className="text-[11px] text-[#A8A49C] ml-auto shrink-0">
                      {formatNotificationTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#6B6862] leading-[1.55] mt-0.5">{n.body}</p>
                  <div className="flex gap-3 mt-2">
                    {n.link && (
                      <button
                        type="button"
                        onClick={() => handleOpen(n)}
                        className="text-[12px] font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                      >
                        Xem chi tiết
                      </button>
                    )}
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n._id).catch(() => setError("Không thể đánh dấu đã đọc"))}
                        className="text-[12px] font-semibold text-[#6B6862] hover:text-[#191817] cursor-pointer"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMore && !loading && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="self-center px-5 py-2 rounded-full border border-[#E4E1DC] bg-white text-[12.5px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
          >
            {loadingMore ? "Đang tải…" : "Tải thêm"}
          </button>
        )}
      </div>
    </>
  );
}
