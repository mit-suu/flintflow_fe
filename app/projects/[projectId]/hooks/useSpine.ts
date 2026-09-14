"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSpine } from "@/lib/api/spine";
import type { Spine } from "@/types/spine";

export interface UseSpineResult {
  spine: Spine | null;
  version: number | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Nhận Spine mới từ response ghi (ApplyResult) mà không gọi lại API. */
  replace: (spine: Spine) => void;
}

/** Không lùi về bản cũ hơn bản đang giữ của cùng project (response về trễ). */
const newer = (current: Spine | null, next: Spine): Spine =>
  current && current.projectId === next.projectId && current.spine_version > next.spine_version ? current : next;

/** `GET /projects/:id/spine`; `version` là `spine_version` dùng làm `base_version` khi ghi. */
export function useSpine(projectId: string, enabled = true): UseSpineResult {
  const [spine, setSpine] = useState<Spine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Chỉ response của lần gọi mới nhất được áp — reload chồng nhau không ghi đè bằng dữ liệu cũ
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    return getSpine(projectId)
      .then((res) => {
        if (request !== requestRef.current) return;
        const next = res.data;
        setSpine((current) => (next ? newer(current, next) : next));
        setError(null);
      })
      .catch((err: unknown) => {
        if (request === requestRef.current) setError(err instanceof Error ? err.message : "Không tải được Spine");
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId]);

  const replace = useCallback((next: Spine) => {
    requestRef.current++;
    setSpine((current) => newer(current, next));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !projectId) return;
    void reload();
  }, [enabled, projectId, reload]);

  return { spine, version: spine?.spine_version ?? null, loading, error, reload, replace };
}
