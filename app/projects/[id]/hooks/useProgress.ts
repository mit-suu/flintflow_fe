"use client";

import { useCallback, useEffect, useState } from "react";
import { getProgress, listSteps } from "@/lib/api/pipeline";
import type { ProgressResponse, StepsResponse } from "@/types/pipeline";

export interface UseProgressResult {
  progress: ProgressResponse | null;
  steps: StepsResponse | null;
  error: string | null;
  reload: () => Promise<void>;
}

/** `GET /progress` + `GET /steps`, tải lại mỗi khi `spineVersion` đổi. */
export function useProgress(projectId: string, spineVersion: number | null): UseProgressResult {
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [steps, setSteps] = useState<StepsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      Promise.all([getProgress(projectId), listSteps(projectId)])
        .then(([progressRes, stepsRes]) => {
          setProgress(progressRes.data);
          setSteps(stepsRes.data);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được tiến độ")),
    [projectId]
  );

  useEffect(() => {
    if (!projectId || spineVersion === null) return;
    void reload();
  }, [projectId, spineVersion, reload]);

  return { progress, steps, error, reload };
}
