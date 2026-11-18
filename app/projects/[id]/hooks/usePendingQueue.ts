"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPendingQueue } from "@/lib/api/pending-queue";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { PendingQueue } from "@/types/pending-queue";

export interface UsePendingQueueResult {
  /** `null` = chưa tải xong hoặc lần tải gần nhất lỗi (không giữ hàng cũ để khỏi quyết trên dữ liệu lỗi thời). */
  queue: PendingQueue | null;
  loading: boolean;
  error: string | null;
  /** Tải lại ngay sau một lượt ghi; trả hàng mới, hoặc `null` khi lỗi / đã có lượt tải mới hơn. */
  reload: () => Promise<PendingQueue | null>;
}

/**
 * `GET /pending-queue`: tải lại mỗi khi `spineVersion` đổi và khi nơi gọi `reload()` tay sau mỗi ghi. Chỉ response của
 * lần gọi mới nhất được áp (cùng pattern `useFlags.ts`). `enabled = false` (chế độ 1, Viewer) ⇒ không gọi gì.
 */
export function usePendingQueue(projectId: string, spineVersion: number | null, enabled = true): UsePendingQueueResult {
  const [queue, setQueue] = useState<PendingQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(async (): Promise<PendingQueue | null> => {
    if (!projectId) return null;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const res = await getPendingQueue(projectId);
      const data: PendingQueue = { total: res.data?.total ?? 0, items: res.data?.items ?? [] };
      if (request !== requestRef.current) return null;
      setQueue(data);
      setError(null);
      return data;
    } catch (err) {
      if (request !== requestRef.current) return null;
      setQueue(null);
      setError(userErrorMessage(err));
      return null;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!enabled || !projectId || spineVersion === null) return;
    // Lùi một microtask: `reload()` tự `setLoading(true)` đồng bộ - gọi thẳng trong effect bị lint set-state-in-effect chặn
    queueMicrotask(() => void reload());
  }, [enabled, projectId, spineVersion, reload]);

  return { queue, loading, error, reload };
}
