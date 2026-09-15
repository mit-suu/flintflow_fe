"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { getDocument } from "@/lib/api/export";
import type { DocumentSource, DraftMeta, RenderedDocument } from "@/types/document";

export interface UseDocumentResult {
  document: RenderedDocument | null;
  meta: DraftMeta | null;
  loading: boolean;
  /** 409 `NO_WORKING_DRAFT` — chưa từng `POST /assemble` (S-8.2). */
  notAssembled: boolean;
  error: string | null;
  reload: () => Promise<void>;
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

  const reload = useCallback(() => {
    setLoading(true);
    return getDocument(projectId, source, baselineId)
      .then((res) => {
        setDocument(res.data);
        setMeta(isDraftMeta(res.meta) ? res.meta : null);
        setNotAssembled(false);
        setError(null);
      })
      .catch((err: unknown) => {
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
      .finally(() => setLoading(false));
  }, [projectId, source, baselineId]);

  useEffect(() => {
    if (!projectId) return;
    void reload();
  }, [projectId, reload, refreshToken]);

  return { document, meta, loading, notAssembled, error, reload };
}
