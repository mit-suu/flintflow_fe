"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatNotificationTime } from "../lib/time-ago";
import { useNotificationText } from "../lib/notification-text";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  onNotificationsChanged,
  type AppNotification,
} from "../lib/api/notifications";

const POLL_MS = 60_000;
const PREVIEW_LIMIT = 6;

/** Số thông báo chưa đọc: poll 60s, tải lại khi focus tab hoặc khi có thay đổi. */
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchUnreadCount();
        if (!cancelled) setCount(next);
      } catch {
        // Giữ số cũ khi lỗi mạng; lần poll sau sẽ thử lại
      }
    };

    void load();
    const timer = window.setInterval(load, POLL_MS);
    const unsubscribe = onNotificationsChanged(load);
    window.addEventListener("focus", load);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubscribe();
      window.removeEventListener("focus", load);
    };
  }, []);

  return count;
}

export default function NotificationBell() {
  const unreadCount = useUnreadNotificationCount();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations("app.notifications");
  const tCommon = useTranslations("app.common");
  const tTime = useTranslations("app.time");
  const locale = useLocale();
  const textOf = useNotificationText();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: latest } = await fetchNotifications({ limit: PREVIEW_LIMIT });
      setItems(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadPreview();
  };

  const handleItemClick = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
        setItems((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      } catch {
        // Không chặn điều hướng nếu đánh dấu thất bại
      }
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("markFailed"));
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? t("unreadAria", { count: unreadCount }) : t("title")}
        className="relative w-[30px] h-[30px] rounded-[9px] bg-[#F5F3F0] border border-[#E4E1DC] flex items-center justify-center text-[13px] cursor-pointer hover:bg-[#FAF9F7] transition-colors"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full bg-[#B03030] text-white text-[9px] font-extrabold flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[340px] max-w-[calc(100vw-32px)] bg-white border border-[#ECEAE5] rounded-[14px] shadow-[0_16px_42px_rgba(25,24,23,0.18)] z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EEEA]">
            <span className="text-[13px] font-extrabold text-[#191817]">{t("title")}</span>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="text-[11.5px] font-semibold text-[#4F46E5] hover:underline disabled:text-[#A8A49C] disabled:no-underline cursor-pointer"
            >
              {t("markAll")}
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#A8A49C]">{tCommon("loading")}</div>
            ) : error ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#8A4141]">{error}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#A8A49C]">{t("empty")}</div>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left flex gap-2.5 px-4 py-3 border-b border-[#F7F6F3] last:border-b-0 hover:bg-[#FAF9F7] transition-colors cursor-pointer ${
                    n.readAt ? "" : "bg-[#F8F7FF]"
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-[#4F46E5]"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold text-[#191817] truncate">{textOf(n).title}</span>
                    <span className="block text-[11.5px] text-[#6B6862] leading-[1.45] line-clamp-2">{textOf(n).body}</span>
                    <span className="block text-[10.5px] text-[#A8A49C] mt-0.5">
                      {formatNotificationTime(n.createdAt, tTime, locale)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <Link
            href="/home/notifications"
            onClick={() => setOpen(false)}
            className="block text-center px-4 py-2.5 text-[12px] font-bold text-[#3B34B0] bg-[#FAF9F7] hover:bg-[#F4F3FE] transition-colors"
          >
            {t("viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
