"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { assembleDocument, getDocument } from "@/lib/api/export";
import type { DocumentSource, DraftMeta, RenderedDocument } from "@/types/document";

export interface UseDocumentResult {
  document: RenderedDocument | null;
  meta: DraftMeta | null;
  loading: boolean;
  /** Chưa từng ghép bản nháp (S-8.2). BE trả 200 kèm `meta.state = "not_assembled"` — không phải lỗi. */
  notAssembled: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** `POST /assemble` ở `baseVersion` rồi tải lại — gỡ kẹt project đã qua S-8.2 mà chưa từng ghép. */
  assemble: (baseVersion: number | null) => Promise<void>;
  assembling: boolean;
  assembleError: string | null;
}

const isDraftMeta = (meta: Record<string, unknown> | undefined): meta is Record<string, unknown> & DraftMeta =>
  typeof meta?.assembled_at_version === "number" && typeof meta?.spine_version === "number";

/**
 * `GET /document` — tải lại khi `source`/`baselineId` đổi hoặc `refreshToken` tăng (vd sau khi
 * step ghi op mới hoặc ChangePanel áp một lô).
 */
export function useDocument(
  projectId: string,
  source: DocumentSource = "draft",
  baselineId?: string,
  refreshToken = 0
): UseDocumentResult {
  const [document, setDocument] = useState<RenderedDocument | null>(null);
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAssembled, setNotAssembled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chỉ response của lần gọi mới nhất được áp (cùng pattern `useSpine.ts`) — tránh một `reload()`
  // gọi tay ghi đè bằng response của lần tải trước đó về muộn hơn.
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    return getDocument(projectId, source, baselineId)
      .then((res) => {
        if (request !== requestRef.current) return;
        // BUG-31: "chưa ghép" là trạng thái bình thường của dự án đang làm dở, BE trả 200 + meta.state
        const notAssembledYet = res.data === null && res.meta?.state === "not_assembled";
        setDocument(res.data);
        setMeta(isDraftMeta(res.meta) ? res.meta : null);
        setNotAssembled(notAssembledYet);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request !== requestRef.current) return;
        setDocument(null);
        setMeta(null);
        if (err instanceof ApiClientError && err.code === "NO_WORKING_DRAFT") {
          setNotAssembled(true);
          setError(err.message);
        } else {
          setNotAssembled(false);
          setError(err instanceof Error ? err.message : "Không tải được tài liệu");
        }
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId, source, baselineId]);

  const [assembling, setAssembling] = useState(false);
  const [assembleError, setAssembleError] = useState<string | null>(null);

  const assemble = useCallback(
    async (baseVersion: number | null) => {
      if (baseVersion === null) {
        setAssembleError("Spine chưa tải xong — thử lại sau giây lát.");
        return;
      }
      setAssembling(true);
      setAssembleError(null);
      try {
        await assembleDocument(projectId, baseVersion);
        await reload();
      } catch (err) {
        setAssembleError(
          err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT"
            ? "Tài liệu vừa đổi ở phiên khác — tải lại trang rồi thử ghép lại."
            : err instanceof Error
              ? err.message
              : "Không ghép được tài liệu"
        );
      } finally {
        setAssembling(false);
      }
    },
    [projectId, reload]
  );

  useEffect(() => {
    if (!projectId) return;
    // Lùi một microtask: `reload()` tự `setLoading(true)` đồng bộ (T1) — gọi thẳng trong effect bị
    // lint `react-hooks/set-state-in-effect` chặn (cùng pattern `ChangePanel.tsx`).
    queueMicrotask(() => void reload());
  }, [projectId, reload, refreshToken]);

  return { document, meta, loading, notAssembled, error, reload, assemble, assembling, assembleError };
}
