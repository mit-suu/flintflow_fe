"use client";

import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { applyChanges, listChanges, previewChanges, reconcile, undoLastChange } from "@/lib/api/spine";
import type { ApplyResult, ChangeRequestInfo, Op, PreviewResult } from "@/types/pipeline";
import type { Change } from "@/types/spine";
import { userErrorMessage } from "@/lib/api/error-messages";
import { HOOK_ERROR } from "@/lib/hook-errors";

export type PreviewSource = "instruction" | "reconcile";
/** `skipped`: chưa gửi gì (chưa biết version, lệnh rỗng). */
export type PreviewOutcome = "preview" | "clarification" | "error" | "skipped";

export interface UseChangesResult {
  preview: PreviewResult | null;
  previewSource: PreviewSource | null;
  /** Câu lệnh của bản xem trước đang hiển thị — mode 1 v3 dùng làm mô tả CR. */
  pendingInstruction: string;
  previewing: boolean;
  applying: boolean;
  /** `NEEDS_CLARIFICATION` (UC 6.11) — câu hỏi làm rõ lệnh, chưa có preview. */
  clarification: string | null;
  error: string | null;
  history: Change[];
  historyLoading: boolean;
  /** Xong khi BE đã trả lời (và đã ghi lượt này vào phiên nếu có `getSessionId`) — trả về BE trả lời bằng gì. */
  requestPreview: (instruction: string) => Promise<PreviewOutcome>;
  /**
   * Xem trước một lô op FE tự dựng (FLF-278: nội dung thư viện tổ chức) — không gọi model, xác nhận như lệnh sửa.
   * `label` thay câu lệnh trên thẻ sửa.
   */
  requestOpsPreview: (ops: Op[], label: string) => Promise<PreviewOutcome>;
  /**
   * Xác nhận `preview` đang hiển thị — tự chọn `applyChanges` hay `reconcile` theo nguồn gốc.
   * `reason` + `changeRequest` bắt buộc khi `preview.branch === "post_baseline"` (BE trả 400 nếu thiếu — FLF-294).
   */
  /** `commentId` (FLF-271): lượt sửa theo góp ý Lead ghim — BE tự đóng comment `fixed` sau khi áp. */
  confirmPreview: (reason?: string, changeRequest?: ChangeRequestInfo, commentId?: string | null) => Promise<void>;
  cancelPreview: () => void;
  /** Nhận bản xem trước BE đã dựng từ tin chat thường (tin bị nhận là lệnh sửa) — để thẻ sửa có nút Áp dụng. */
  adoptPreview: (preview: PreviewResult, instruction: string) => void;
  reconcileOnce: () => Promise<void>;
  undo: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

const isPreviewResult = (result: PreviewResult | ApplyResult): result is PreviewResult => "ok" in result;

export interface UseChangesOptions {
  /**
   * Cổng trước khi gửi `/changes/preview` và `/changes`: nếu tab biết Spine / tài liệu ở BE đã mới hơn thì tải lại Spine
   * (nâng `base_version`) + tài liệu rồi mới gửi. Trả `true` khi đã đồng bộ — bản xem trước dựng trên Spine cũ khi đó không
   * còn hợp lệ. Lỗi của cổng không chặn gửi (lỗi thật nếu có sẽ do BE báo).
   */
  syncBeforeSend?: () => Promise<boolean>;
  /** `409 SPINE_VERSION_CONFLICT`: Spine đổi ở nơi khác giữa lúc xem trước và gửi — tải lại Spine + tài liệu, KHÔNG tự gửi lại. */
  onConflict?: () => void;
}

const isConflict = (err: unknown): boolean => err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT";

const failureMessage = (err: unknown): string =>
  isConflict(err) ? HOOK_ERROR.documentChanged : userErrorMessage(err, HOOK_ERROR.actionFailed);

/** Xem trước / xác nhận lệnh sửa qua chat (UC 6.8–6.11), hoà giải, undo, lịch sử — trên mock T16. */
export function useChanges(
  projectId: string,
  getBaseVersion: () => number | null,
  /** Seq lớn nhất đã biết của Spine hiện tại (`max(steps[].last_seq)`) — giới hạn `GET /changes`
   * về 20 dòng gần nhất thay vì tải toàn bộ lịch sử. `null` khi chưa xác định được (tải không giới hạn). */
  getLatestSeq: () => number | null,
  /** `impactedSectionIds` (từ `preview.impact.sections`, nếu preview có) — cha dùng để highlight DocumentPane. */
  onApplied: (result: ApplyResult, impactedSectionIds?: string[]) => void,
  /** Phiên chat đang mở — lệnh sửa gửi kèm để model đọc được các tin trước và lượt sửa nằm lại trong phiên. */
  getSessionId: () => string | null = () => null,
  { syncBeforeSend, onConflict }: UseChangesOptions = {}
): UseChangesResult {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState("");
  /** Lô op của bản xem trước dựng từ op (không phải câu lệnh) — xác nhận gửi lại đúng lô cùng `preview_id`. */
  const [pendingOps, setPendingOps] = useState<Op[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Change[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /** Chạy cổng đồng bộ (nếu có); lỗi cổng không chặn gửi. */
  const syncFirst = useCallback(async (): Promise<boolean> => {
    if (!syncBeforeSend) return false;
    try {
      return await syncBeforeSend();
    } catch {
      return false;
    }
  }, [syncBeforeSend]);
  const handleFailure = useCallback(
    (err: unknown) => {
      setError(failureMessage(err));
      if (isConflict(err)) onConflict?.();
    },
    [onConflict]
  );

  const requestPreview = useCallback(
    async (instruction: string): Promise<PreviewOutcome> => {
      if (getBaseVersion() === null || !instruction.trim()) return "skipped";
      setPreviewing(true);
      setError(null);
      setClarification(null);
      setPreview(null);
      setPendingOps(null);
      setPendingInstruction(instruction.trim());
      try {
        await syncFirst();
        const baseVersion = getBaseVersion();
        if (baseVersion === null) return "skipped";
        const sessionId = getSessionId();
        const res = await previewChanges(projectId, {
          instruction: instruction.trim(),
          base_version: baseVersion,
          ...(sessionId ? { session_id: sessionId } : {}),
        });
        if (res.data?.clarification) {
          setClarification(res.data.clarification);
          return "clarification";
        }
        setPreview(res.data);
        setPreviewSource("instruction");
        return "preview";
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "NEEDS_CLARIFICATION") {
          // Câu hỏi làm rõ của AI là nội dung, không phải lỗi — lấy nguyên văn, không qua bộ lọc text kỹ thuật
          setClarification(err.rawMessage || err.message);
          return "clarification";
        }
        handleFailure(err);
        return "error";
      } finally {
        setPreviewing(false);
      }
    },
    [projectId, getBaseVersion, getSessionId, syncFirst, handleFailure]
  );

  const requestOpsPreview = useCallback(
    async (ops: Op[], label: string): Promise<PreviewOutcome> => {
      if (getBaseVersion() === null || ops.length === 0) return "skipped";
      setPreviewing(true);
      setError(null);
      setClarification(null);
      setPreview(null);
      setPendingOps(ops);
      setPendingInstruction(label);
      try {
        await syncFirst();
        const baseVersion = getBaseVersion();
        if (baseVersion === null) return "skipped";
        const res = await previewChanges(projectId, { ops, base_version: baseVersion });
        setPreview(res.data);
        setPreviewSource("instruction");
        return "preview";
      } catch (err) {
        handleFailure(err);
        return "error";
      } finally {
        setPreviewing(false);
      }
    },
    [projectId, getBaseVersion, syncFirst, handleFailure]
  );

  const cancelPreview = useCallback(() => {
    setPreview(null);
    setPreviewSource(null);
    setClarification(null);
  }, []);

  const adoptPreview = useCallback((next: PreviewResult, instruction: string) => {
    setError(null);
    setClarification(null);
    setPendingOps(null);
    setPendingInstruction(instruction.trim());
    setPreview(next);
    setPreviewSource("instruction");
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
      handleFailure(err);
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, onApplied, handleFailure]);

  const confirmPreview = useCallback(
    async (reason?: string, changeRequest?: ChangeRequestInfo, commentId?: string | null) => {
      if (getBaseVersion() === null || !preview?.preview_id || !previewSource) return;
      setApplying(true);
      setError(null);
      const sessionId = getSessionId();
      try {
        const synced = await syncFirst();
        const baseVersion = getBaseVersion();
        if (baseVersion === null) return;
        // Spine vừa được kéo lên bản mới hơn bản mà xem trước dựng trên đó ⇒ xem trước không còn đúng: bỏ, user xem trước lại
        if (synced && preview.base_version < baseVersion) {
          setPreview(null);
          setPreviewSource(null);
          setError(HOOK_ERROR.documentChanged);
          return;
        }
        const res =
          previewSource === "instruction"
            ? await applyChanges(projectId, {
                ...(pendingOps ? { ops: pendingOps } : { instruction: pendingInstruction }),
                base_version: baseVersion,
                preview_id: preview.preview_id,
                ...(sessionId ? { session_id: sessionId } : {}),
                // Sau baseline BE bắt buộc lý do ở cấp transaction (vào Record of Changes)
                ...(reason?.trim() ? { reason: reason.trim() } : {}),
                // FLF-294: sau baseline lượt áp là một change request (người yêu cầu + nguồn)
                ...(changeRequest ? { change_request: changeRequest } : {}),
                // FLF-271: sửa theo góp ý ⇒ BE đóng comment `fixed` khi có thay đổi thật
                ...(commentId ? { comment_id: commentId } : {}),
              })
            : await reconcile(projectId, { base_version: baseVersion, preview_id: preview.preview_id });
        if (res.data && !isPreviewResult(res.data)) {
          onApplied(res.data, preview.impact?.sections.map((s) => s.id));
          setPreview(null);
          setPreviewSource(null);
        }
      } catch (err) {
        handleFailure(err);
        // 409 thật: bản xem trước dựng trên Spine cũ — bỏ, không để nút Áp dụng gửi lại đúng lô đó
        if (isConflict(err)) {
          setPreview(null);
          setPreviewSource(null);
        }
      } finally {
        setApplying(false);
      }
    },
    [projectId, getBaseVersion, getSessionId, preview, previewSource, pendingInstruction, pendingOps, onApplied, syncFirst, handleFailure]
  );

  const undo = useCallback(async () => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null) return;
    setApplying(true);
    setError(null);
    try {
      const res = await undoLastChange(projectId, { base_version: baseVersion });
      if (res.data) onApplied(res.data);
    } catch (err) {
      handleFailure(err);
    } finally {
      setApplying(false);
    }
  }, [projectId, getBaseVersion, onApplied, handleFailure]);

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
    pendingInstruction,
    preview,
    previewSource,
    previewing,
    applying,
    clarification,
    error,
    history,
    historyLoading,
    requestPreview,
    requestOpsPreview,
    confirmPreview,
    cancelPreview,
    adoptPreview,
    reconcileOnce,
    undo,
    loadHistory,
  };
}
