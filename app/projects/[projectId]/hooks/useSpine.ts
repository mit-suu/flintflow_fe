"use client";

import { useCallback, useEffect, useState } from "react";
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

/** `GET /projects/:id/spine`; `version` là `spine_version` dùng làm `base_version` khi ghi. */
export function useSpine(projectId: string, enabled = true): UseSpineResult {
  const [spine, setSpine] = useState<Spine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      getSpine(projectId)
        .then((res) => {
          setSpine(res.data);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được Spine"))
        .finally(() => setLoading(false)),
    [projectId]
  );

  useEffect(() => {
    if (!enabled || !projectId) return;
    void reload();
  }, [enabled, projectId, reload]);

  return { spine, version: spine?.spine_version ?? null, loading, error, reload, replace: setSpine };
}
