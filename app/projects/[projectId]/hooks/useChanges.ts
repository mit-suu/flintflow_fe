"use client";

import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { applyChanges, listChanges, previewChanges, reconcile, undoLastChange } from "@/lib/api/spine";
import type { ApplyResult, PreviewResult } from "@/types/pipeline";
import type { Change } from "@/types/spine";

export interface UseChangesResult {
  preview: PreviewResult | null;
  previewing: boolean;
  applying: boolean;
  /** `NEEDS_CLARIFICATION` (UC 6.11) — câu hỏi làm rõ lệnh, chưa có preview. */
  clarification: string | null;
  error: string | null;
  history: Change[];
  historyLoading: boolean;
  requestPreview: (instruction: string) => Promise<void>;
  confirmPreview: (instruction: string) => Promise<void>;
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
  onApplied: (result: ApplyResult) => void
): UseChangesResult {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
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
      try {
        const res = await previewChanges(projectId, { instruction: instruction.trim(), base_version: baseVersion });
        if (res.data?.clarification) {
          setClarification(res.data.clarification);
        } else {
          setPreview(res.data);
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

  const confirmPreview = useCallback(
    async (instruction: string) => {
      const baseVersion = getBaseVersion();
      if (baseVersion === null || !preview?.preview_id) return;
      setApplying(true);
      setError(null);
      try {
        const res = await applyChanges(projectId, {
          instruction: instruction.trim(),
          base_version: baseVersion,
          preview_id: preview.preview_id,
        });
        if (res.data) onApplied(res.data);
        setPreview(null);
      } catch (err) {
        setError(failureMessage(err));
      } finally {
        setApplying(false);
      }
    },
    [projectId, getBaseVersion, preview, onApplied]
  );

  const cancelPreview = useCallback(() => {
    setPreview(null);
    setClarification(null);
  }, []);

  const reconcileOnce = useCallback(async () => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null) return;
    setApplying(true);
    setError(null);
    try {
      if (preview?.preview_id) {
        const res = await reconcile(projectId, { base_version: baseVersion, preview_id: preview.preview_id });
        if (res.data && !isPreviewResult(res.data)) {
          onApplied(res.data);
          setPreview(null);
        }
      } else {
        const res = await reconcile(projectId, { base_version: baseVersion });
        if (res.data && isPreviewResult(res.data)) setPreview(res.data);
        else if (res.data) onApplied(res.data);
      }
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, preview, onApplied]);

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
      const res = await listChanges(projectId);
      setHistory((res.data ?? []).slice(-20).reverse());
      setError(null);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  return {
    preview,
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
