import { apiCall } from "@/lib/api";

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface FetchNotificationsParams {
  unread?: boolean;
  page?: number;
  limit?: number;
}

// Bell, Sidebar và trang thông báo cùng lắng nghe để cập nhật số chưa đọc
const CHANGED_EVENT = "flintflow:notifications-changed";

export const emitNotificationsChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }
};

export const onNotificationsChanged = (handler: () => void) => {
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
};

export async function fetchNotifications(params: FetchNotificationsParams = {}) {
  const query = new URLSearchParams();
  if (params.unread) query.set("unread", "1");
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  const res = await apiCall<AppNotification[]>(`/notifications${qs ? `?${qs}` : ""}`);
  return {
    items: res.data ?? [],
    meta: res.meta as unknown as NotificationListMeta,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiCall<{ count: number }>("/notifications/unread-count");
  return res.data?.count ?? 0;
}

export async function markNotificationRead(id: string) {
  const res = await apiCall<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" });
  emitNotificationsChanged();
  return res.data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiCall<{ updated: number }>("/notifications/read-all", { method: "PATCH" });
  emitNotificationsChanged();
  return res.data?.updated ?? 0;
}
