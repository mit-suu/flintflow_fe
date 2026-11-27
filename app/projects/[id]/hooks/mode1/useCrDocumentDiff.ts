"use client";

import { useEffect, useState } from "react";
import { getCrDocumentDiff } from "@/lib/api/change-requests";
import type { CrDocumentDiff } from "@/types/change-request";

export interface UseCrDocumentDiffResult {
  diff: CrDocumentDiff | null;
  loading: boolean;
  error: string | null;
}

/**
 * FLF-495: đề xuất của CR tô lên tài liệu. Chỉ tải khi chế độ xem bật (`enabled`); tải lại khi `refreshKey` đổi (đề xuất đổi
 * sau Sửa lại / Bỏ / Đồng ý). Kết quả cũ giữ nguyên trong lúc tải lại để tài liệu không nháy.
 */
export function useCrDocumentDiff(projectId: string, crId: string | null, enabled: boolean, refreshKey = ""): UseCrDocumentDiffResult {
  const [state, setState] = useState<{ key: string; diff: CrDocumentDiff | null; error: string | null }>({ key: "", diff: null, error: null });
  const wanted = enabled && crId ? `${projectId}|${crId}|${refreshKey}` : "";
  useEffect(() => {
    if (!wanted || !crId) return;
    let alive = true;
    getCrDocumentDiff(projectId, crId)
      .then((r) => {
        if (alive) setState((prev) => ({ key: wanted, diff: r.data ?? (prev.key.startsWith(`${projectId}|${crId}|`) ? prev.diff : null), error: r.data ? null : (r.error?.message ?? "error") }));
      })
      .catch((e: unknown) => {
        if (alive) setState((prev) => ({ ...prev, key: wanted, error: e instanceof Error ? e.message : "error" }));
      });
    return () => {
      alive = false;
    };
  }, [wanted, projectId, crId]);
  return { diff: wanted && state.diff?.cr_id === crId ? state.diff : null, loading: !!wanted && state.key !== wanted, error: wanted && state.key === wanted ? state.error : null };
}
