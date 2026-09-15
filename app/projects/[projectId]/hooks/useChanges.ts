"use client";

import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { applyChanges, listChanges, previewChanges, reconcile, undoLastChange } from "@/lib/api/spine";
import type { ApplyResult, PreviewResult } from "@/types/pipeline";
import type { Change } from "@/types/spine";

export type PreviewSource = "instruction" | "reconcile";

export interface UseChangesResult {
  preview: PreviewResult | null;
  previewSource: PreviewSource | null;
  previewing: boolean;
  applying: boolean;
  /** `NEEDS_CLARIFICATION` (UC 6.11) — câu hỏi làm rõ lệnh, chưa có preview. */
  clarification: string | null;
  error: string | null;
  history: Change[];
  historyLoading: boolean;
  requestPreview: (instruction: string) => Promise<void>;
  /** Xác nhận `preview` đang hiển thị — tự chọn `applyChanges` hay `reconcile` theo nguồn gốc. */
  confirmPreview: () => Promise<void>;
  cancelPreview: () => void;
  reconcileOnce: () => Promise<void>;
  undo: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

const isPreviewResult = (result: PreviewResult | ApplyResult): result is PreviewResult => "ok" in result;

/** Xem trước / xác nhận lệnh sửa qua chat (UC 6.8–6.11), hoà giải, undo, lịch sử — trên mock T16. */
export function useChanges(
  projectId: string,
  getBaseVersion: () => number | null,
  /** Seq lớn nhất đã biết của Spine hiện tại (`max(steps[].last_seq)`) — giới hạn `GET /changes`
   * về 20 dòng gần nhất thay vì tải toàn bộ lịch sử. `null` khi chưa xác định được (tải không giới hạn). */
  getLatestSeq: () => number | null,
  /** `impactedSectionIds` (từ `preview.impact.sections`, nếu preview có) — cha dùng để highlight DocumentPane. */
  onApplied: (result: ApplyResult, impactedSectionIds?: string[]) => void
): UseChangesResult {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Change[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const failureMessage = (err: unknown) => (err instanceof Error ? err.message : "Thao tác thất bại");

  const requestPreview = useCallback(
    async (instruction: string) => {
      const baseVersion = getBaseVersion();
      if (baseVersion === null || !instruction.trim()) return;
      setPreviewing(true);
      setError(null);
      setClarification(null);
      setPreview(null);
      setPendingInstruction(instruction.trim());
      try {
        const res = await previewChanges(projectId, { instruction: instruction.trim(), base_version: baseVersion });
        if (res.data?.clarification) {
          setClarification(res.data.clarification);
        } else {
          setPreview(res.data);
          setPreviewSource("instruction");
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "NEEDS_CLARIFICATION") {
          setClarification(err.message);
        } else {
          setError(failureMessage(err));
        }
      } finally {
        setPreviewing(false);
      }
    },
    [projectId, getBaseVersion]
  );

  const cancelPreview = useCallback(() => {
    setPreview(null);
    setPreviewSource(null);
    setClarification(null);
  }, []);

  const reconcileOnce = useCallback(async () => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null) return;
    setApplying(true);
    setError(null);
    try {
      const res = await reconcile(projectId, { base_version: baseVersion });
      if (res.data && isPreviewResult(res.data)) {
        setPreview(res.data);
        setPreviewSource("reconcile");
      } else if (res.data) {
        onApplied(res.data);
      }
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, onApplied]);

  const confirmPreview = useCallback(async () => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null || !preview?.preview_id || !previewSource) return;
    setApplying(true);
    setError(null);
    try {
      const res =
        previewSource === "instruction"
          ? await applyChanges(projectId, { instruction: pendingInstruction, base_version: baseVersion, preview_id: preview.preview_id })
          : await reconcile(projectId, { base_version: baseVersion, preview_id: preview.preview_id });
      if (res.data && !isPreviewResult(res.data)) {
        onApplied(res.data, preview.impact?.sections.map((s) => s.id));
        setPreview(null);
        setPreviewSource(null);
      }
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, preview, previewSource, pendingInstruction, onApplied]);

  const undo = useCallback(async () => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null) return;
    setApplying(true);
    setError(null);
    try {
      const res = await undoLastChange(projectId, { base_version: baseVersion });
      if (res.data) onApplied(res.data);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, onApplied]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const latestSeq = getLatestSeq();
      const range = latestSeq !== null ? { from: Math.max(1, latestSeq - 19) } : {};
      const res = await listChanges(projectId, range);
      setHistory((res.data ?? []).slice(-20).reverse());
      setError(null);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId, getLatestSeq]);

  return {
    preview,
    previewSource,
    previewing,
    applying,
    clarification,
    error,
    history,
    historyLoading,
    requestPreview,
    confirmPreview,
    cancelPreview,
    reconcileOnce,
    undo,
    loadHistory,
  };
}
