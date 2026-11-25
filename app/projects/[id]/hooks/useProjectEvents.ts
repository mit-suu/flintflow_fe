"use client";

import { useEffect, useRef } from "react";
import { openProjectEvents } from "@/lib/api/project-events";
import { ApiClientError } from "@/lib/api/client";
import type { ProjectStreamEvent } from "@/types/project-events";

/** Chờ trước lần nối lại thứ n (mất mạng, server khởi động lại); quá dãy thì giữ số cuối. */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export interface UseProjectEventsOptions {
  projectId: string;
  /** Workspace chưa sẵn sàng ⇒ không mở luồng. */
  enabled: boolean;
  onEvent: (event: ProjectStreamEvent) => void;
}

/**
 * Giữ một luồng SSE `GET /projects/:id/events` (FLF-487) khi tab đang hiện: tab ẩn ⇒ đóng, hiện lại ⇒ mở lại. Luồng đóng
 * (server gửi `bye` sau 10 phút, mất mạng) ⇒ nối lại theo `RECONNECT_DELAYS_MS`; nhận được sự kiện là đặt lại nhịp chờ.
 * 401 / 403 / 404 ⇒ dừng hẳn — polling `/version` và số chưa đọc vẫn chạy nên app không mất gì.
 */
export function useProjectEvents({ projectId, enabled, onEvent }: UseProjectEventsOptions): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const close = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      controller?.abort();
      controller = null;
    };

    const connect = () => {
      if (stopped || controller || document.visibilityState !== "visible") return;
      const current = new AbortController();
      controller = current;
      void openProjectEvents(
        projectId,
        (event) => {
          attempt = 0;
          onEventRef.current(event);
        },
        current.signal
      )
        .catch((err: unknown) => {
          if (err instanceof ApiClientError && [401, 403, 404].includes(err.status)) stopped = true;
        })
        .finally(() => {
          if (controller !== current) return; // đã đóng chủ động (tab ẩn / rời trang)
          controller = null;
          if (stopped || document.visibilityState !== "visible") return;
          const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
          attempt += 1;
          retryTimer = setTimeout(connect, delay);
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        attempt = 0;
        connect();
      } else {
        close();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [enabled, projectId]);
}
