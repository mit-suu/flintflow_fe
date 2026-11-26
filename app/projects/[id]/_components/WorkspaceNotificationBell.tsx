"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CountBadge, Icon } from "@/components/ui";
import Tabs from "@/components/ui/Tabs";
import { useUnreadNotificationCount } from "@/components/NotificationBell";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  onNotificationsChanged,
  type AppNotification,
} from "@/lib/api/notifications";
import { useNotificationText } from "@/lib/notification-text";
import { formatNotificationTime, type TimeTranslator } from "@/lib/time-ago";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { SpineWrittenEvent } from "@/types/project-events";
import { liveWriteText, type LiveWriteTranslator } from "./live-write-text";

type Tab = "project" | "all";

const LIST_LIMIT = 10;

export interface WorkspaceNotificationBellProps {
  /** Hoạt động ghi của người khác trong phiên (mới nhất đầu), từ `useLiveActivity`. */
  activity: readonly SpineWrittenEvent[];
  unseenActivity: number;
  onSeenActivity: () => void;
  /** Số + tên mục đang hiển thị cho một id section. */
  sectionName: (id: string) => string;
  /** Cuộn tài liệu tới mục. */
  onOpenSection: (id: string) => void;
}

/**
 * Chuông ở header workspace (FLF-487): tab "Dự án này" = ai vừa ghi gì trong phiên (từ luồng SSE), tab "Tất cả" = thông báo
 * app của org đang mở. Badge = số thông báo app chưa đọc + số lần ghi chưa xem. Thông báo app mới tới qua SSE ⇒
 * `emitNotificationsChanged` ⇒ số và danh sách tự tải lại.
 */
export default function WorkspaceNotificationBell({ activity, unseenActivity, onSeenActivity, sectionName, onOpenSection }: WorkspaceNotificationBellProps) {
  const t = useTranslations("workspace.bell");
  const tLive = useTranslations("workspace.liveWrite");
  const tNotif = useTranslations("app.notifications");
  const tTime = useTranslations("app.time");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const router = useRouter();
  const notificationText = useNotificationText();
  const unread = useUnreadNotificationCount();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("project");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Tab "Tất cả" đang mở ⇒ tải và theo dõi thay đổi (SSE `notification_created`, đánh dấu đọc ở nơi khác)
  useEffect(() => {
    if (!open || tab !== "all") return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchNotifications({ limit: LIST_LIMIT });
        if (cancelled) return;
        setItems(res.items);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
    const unsubscribe = onNotificationsChanged(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open, tab]);

  // Đang mở tab "Dự án này" thì dòng mới tới coi như đã xem
  useEffect(() => {
    if (open && tab === "project" && unseenActivity > 0) onSeenActivity();
  }, [open, tab, unseenActivity, onSeenActivity]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const badge = unread + unseenActivity;
  const time = (iso: string) => formatNotificationTime(iso, tTime as TimeTranslator, locale);

  const openNotification = async (n: AppNotification) => {
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      await markNotificationRead(n._id).catch(() => undefined);
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={badge > 0 ? t("aria", { count: badge }) : t("label")}
        title={t("label")}
        className="relative w-9 h-9 grid place-items-center rounded-control text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="bell" size={16} />
        {badge > 0 && <CountBadge count={badge} tone="alert" className="absolute -top-0.5 -right-0.5" />}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("label")}
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(92vw,400px)] bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-2 flex flex-col gap-1"
        >
          <Tabs
            label={t("label")}
            idBase={`${panelId}-tabs`}
            value={tab}
            onChange={setTab}
            layout="grid"
            className="grid-cols-2"
            options={[
              { value: "project", label: t("tabProject"), ...(unseenActivity > 0 ? { count: unseenActivity } : {}) },
              { value: "all", label: t("tabAll"), ...(unread > 0 ? { count: unread } : {}) },
            ]}
          />
          <div role="tabpanel" id={`${panelId}-tabs-panel`} aria-labelledby={`${panelId}-tabs-tab-${tab}`} className="max-h-[60vh] overflow-y-auto">
            {tab === "project" ? (
              activity.length === 0 ? (
                <p className="px-2 py-6 text-center text-body text-on-surface-variant">{t("projectEmpty")}</p>
              ) : (
                <ul className="flex flex-col">
                  {activity.map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (e.sections[0]) onOpenSection(e.sections[0]);
                          setOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-control hover:bg-surface-container cursor-pointer flex items-center gap-2.5"
                      >
                        {/* Chữ cái đầu tên người ghi: nhận ra ai sửa mà không cần đọc hết dòng */}
                        <span aria-hidden className="size-7 shrink-0 rounded-full bg-primary-soft text-primary text-caption font-bold grid place-items-center">
                          {(e.actor_name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 text-body text-on-surface line-clamp-2">{liveWriteText(e, sectionName, tLive as LiveWriteTranslator)}</span>
                        <span className="shrink-0 text-caption text-on-surface-subtle">{time(e.at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : loadFailed ? (
              <p className="px-2 py-6 text-center text-body text-on-surface-variant">{tNotif("loadFailed")}</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-center text-body text-on-surface-variant">{tNotif("empty")}</p>
            ) : (
              <ul className="flex flex-col">
                {items.map((n) => {
                  const text = notificationText(n);
                  return (
                    <li key={n._id}>
                      {/* Popover hẹp: chưa đọc chỉ báo bằng chấm + chữ đậm, không tô nền (cả danh sách chưa đọc thành một mảng tím);
                          nội dung một dòng, đọc đủ ở trang Thông báo */}
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className="w-full text-left px-2.5 py-2 rounded-control hover:bg-surface-container cursor-pointer flex gap-2.5"
                      >
                        <span aria-hidden className={`mt-[7px] size-1.5 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-primary"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={`text-body truncate ${n.readAt ? "text-on-surface-variant" : "font-bold text-on-surface"}`}>{text.title}</span>
                            <span className="ml-auto shrink-0 text-caption text-on-surface-subtle">{time(n.createdAt)}</span>
                          </span>
                          <span className="block text-caption text-on-surface-subtle truncate">{text.body}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            {tab === "project" ? (
              <span className="text-caption text-on-surface-subtle">{t("projectHint")}</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead().catch(() => undefined)}
                  disabled={unread === 0}
                  className="text-body font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-50 cursor-pointer disabled:cursor-default"
                >
                  {tNotif("markAll")}
                </button>
                <Link href="/home/notifications" onClick={() => setOpen(false)} className="text-body font-semibold text-primary hover:underline">
                  {tNotif("viewAll")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
