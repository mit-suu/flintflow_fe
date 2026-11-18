"use client";

import { useEffect, useRef } from "react";

/**
 * "Đến lượt bạn" (03-live-status-flow Lớp 5).
 *
 * Một bước mất 30 giây tới hai phút. Nếu user phải ngồi canh màn hình để biết khi nào tới lượt mình thì
 * mọi thứ khác trong plan đều vô nghĩa. Khi cần tới người mà tab đang ẩn: đổi tiêu đề tab, và bắn một
 * Browser Notification **nếu user đã cho phép** — không bao giờ tự đi xin quyền giữa chừng, đó là kiểu
 * làm phiền khiến người ta chặn luôn.
 */
export interface TurnNoticeText {
  /** Câu báo (thân notification). */
  detail: string;
  /** Tiêu đề tab khi tới lượt user — vd "(1) Đến lượt bạn — FlintFlow". */
  title: string;
  /** Tiêu đề notification. */
  notification: string;
}

/** Chữ do nơi gọi dịch sẵn (`workspace.turnNotice`) — hook không tự gọi `useTranslations`. */
export function useTurnNotice(needsUser: boolean, { detail, title, notification }: TurnNoticeText): void {
  const originalTitle = useRef<string | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (originalTitle.current === null) originalTitle.current = document.title;

    if (!needsUser) {
      notified.current = false;
      if (originalTitle.current !== null) document.title = originalTitle.current;
      return;
    }

    const hidden = document.visibilityState === "hidden";
    if (hidden) document.title = title;

    if (hidden && !notified.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      notified.current = true;
      try {
        new Notification(notification, { body: detail, tag: "flintflow-turn" });
      } catch {
        // Trình duyệt chặn: tiêu đề tab đã đủ để biết
      }
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible" || originalTitle.current === null) return;
      document.title = originalTitle.current;
      notified.current = false;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [needsUser, detail, title, notification]);
}
