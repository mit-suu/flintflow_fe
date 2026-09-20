"use client";

// Số chưa đọc cho mục "Thông báo" ở sidebar. Dropdown chuông cũ đã bỏ: sidebar của app shell có mục Thông báo
// kèm số chưa đọc. Định dạng thời gian dùng `lib/time-ago.ts` (theo ngôn ngữ đang hiển thị).
import { useEffect, useState } from "react";
import { fetchUnreadCount, onNotificationsChanged } from "../lib/api/notifications";

const POLL_MS = 60_000;

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
