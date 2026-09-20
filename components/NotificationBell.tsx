"use client";

// Số chưa đọc (mục "Thông báo" ở sidebar) + định dạng thời gian dùng chung. Dropdown chuông cũ đã bỏ:
// sidebar của app shell có mục Thông báo kèm số chưa đọc.
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

export function formatNotificationTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}
