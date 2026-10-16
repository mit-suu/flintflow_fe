"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listRequirementSources } from "@/lib/api/sources";
import type { RequirementSource } from "@/types/sources";
import { userErrorMessage } from "@/lib/api/error-messages";

export interface UseSourcesResult {
  sources: RequirementSource[];
  loading: boolean;
  error: string | null;
}

/** `GET /sources` (FLF-292), tải lại mỗi khi `spineVersion` đổi — lượt Draft mới có thể ghi nguồn mới. */
export function useSources(projectId: string, spineVersion: number | null): UseSourcesResult {
  const [sources, setSources] = useState<RequirementSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Chỉ response của lần gọi mới nhất được áp (cùng pattern `useFlags.ts`)
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    return listRequirementSources(projectId)
      .then((res) => {
        if (request !== requestRef.current) return;
        setSources(res.data?.sources ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request === requestRef.current) setError(userErrorMessage(err, "Không tải được nguồn tài liệu"));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || spineVersion === null) return;
    // Lùi một microtask: `reload()` tự `setLoading(true)` — gọi thẳng trong effect bị lint `react-hooks/set-state-in-effect` chặn
    queueMicrotask(() => void reload());
  }, [projectId, spineVersion, reload]);

  return { sources, loading, error };
}
