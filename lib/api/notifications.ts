/**
 * Khung API notification in-app — endpoint theo T04; T04 chốt shape response khi BE merge.
 */
import { apiCall } from "./client";

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export const listNotifications = ({ unread = false }: { unread?: boolean } = {}) =>
  apiCall<AppNotification[]>(unread ? "/notifications?unread=1" : "/notifications");

export const getUnreadNotificationCount = () =>
  apiCall<{ count: number }>("/notifications/unread-count");

export const markNotificationRead = (notificationId: string) =>
  apiCall<AppNotification>(`/notifications/${notificationId}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  apiCall<unknown>("/notifications/read-all", { method: "PATCH" });
