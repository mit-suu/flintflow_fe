"use client";

import { useCallback, useEffect, useState } from "react";
import { getStepPlan, patchStepPlan } from "@/lib/api/import";
import type { StepPlanEntry } from "@/types/import";
import { errorText } from "../../_components/mode1/errors";

/**
 * Kế hoạch step theo template của project mode 1 v2 (#32–#33, FLF-185): step áp dụng / ẩn / bật thêm, đầu mục FPT
 * thiếu. `toggle` bật step ẩn hoặc tắt step đã bật — BE đổi `steps[]` + `progress` ⇒ gọi `onChanged` để tải lại
 * Spine/tiến độ. Tải lại khi `refreshKey` đổi (vd `spine_version`).
 */
export function useStepPlan(projectId: string, enabled: boolean, refreshKey: unknown, onChanged?: () => void) {
  const [steps, setSteps] = useState<StepPlanEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getStepPlan(projectId)
      .then((res) => {
        if (cancelled) return;
        setSteps(res.data?.steps ?? []);
        setError(null);
      })
      .catch((err: unknown) => !cancelled && setError(errorText(err, "Không tải được kế hoạch step")));
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, refreshKey]);

  const toggle = useCallback(
    async (stepId: string, on: boolean) => {
      setBusyStep(stepId);
      try {
        const res = await patchStepPlan(projectId, { step_id: stepId, enabled: on });
        setSteps(res.data?.steps ?? []);
        setError(null);
        onChanged?.();
      } catch (err) {
        setError(errorText(err, on ? "Không bật được step" : "Không tắt được step"));
      } finally {
        setBusyStep(null);
      }
    },
    [projectId, onChanged]
  );

  return { steps, error, busyStep, toggle };
}
