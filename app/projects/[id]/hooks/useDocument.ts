"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDocument } from "@/lib/api/export";
import { translationMetaOf } from "@/lib/document-language";
import type { DocumentSource, DocumentTranslationMeta, DraftMeta, RenderedDocument } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";

export interface UseDocumentResult {
  document: RenderedDocument | null;
  meta: DraftMeta | null;
  /**
   * `meta.translation` (FLF-265): chỉ có khi ngôn ngữ tài liệu khác ngôn ngữ gốc của Spine — `missing` là số mục đang in
   * chữ gốc. `null` ⇒ tài liệu ở ngôn ngữ gốc (hoặc chưa tải).
   */
  translation: DocumentTranslationMeta | null;
  /** Lượt tải đầu tiên — chưa có gì để hiện. Các lượt tải lại sau giữ bản đang đọc trên màn (`refreshing`). */
  loading: boolean;
  /** Đang tải lại trong khi bản hiện tại vẫn hiển thị. */
  refreshing: boolean;
  /** Dự án chưa có nội dung nào để dựng tài liệu — BE trả 200 kèm `meta.state = "not_assembled"`, không phải lỗi. */
  empty: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const isDraftMeta = (meta: Record<string, unknown> | undefined): meta is Record<string, unknown> & DraftMeta =>
  typeof meta?.assembled_at_version === "number" && typeof meta?.spine_version === "number";

/**
 * `GET /document` — tải lại khi `source`/`baselineId` đổi hoặc `refreshToken` tăng (vd sau khi step ghi op mới
 * hoặc lệnh sửa trong chat áp một lô). BE tự dựng bản còn thiếu nên lượt tải lại luôn ra nội dung mới nhất;
 * FE không còn phải xin ghép hay báo "tài liệu đã cũ" (FLF-264).
 *
 * Tải lại KHÔNG gỡ bản đang đọc xuống: `loading` chỉ bật ở lượt đầu. Trước đây mỗi lượt tải lại đều dựng lại
 * toàn bộ danh sách mục, nên người đang đọc giữa tài liệu bị ném về đầu trang sau mỗi lệnh sửa.
 *
 * `language` (FLF-265) là ngôn ngữ tài liệu của dự án: BE dựng tài liệu theo nó, nên đổi ngôn ngữ là đổi hẳn tài liệu
 * (như đổi nguồn) — gỡ bản cũ xuống thay vì để chữ ngôn ngữ cũ đứng trên màn tới khi bản mới về.
 */
export function useDocument(
  projectId: string,
  source: DocumentSource = "draft",
  baselineId?: string,
  refreshToken = 0,
  language?: DocumentLanguage | null
): UseDocumentResult {
  const [document, setDocument] = useState<RenderedDocument | null>(null);
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [translation, setTranslation] = useState<DocumentTranslationMeta | null>(null);
  const [pending, setPending] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chỉ response của lần gọi mới nhất được áp (cùng pattern `useSpine.ts`) — tránh một `reload()`
  // gọi tay ghi đè bằng response của lần tải trước đó về muộn hơn.
  const requestRef = useRef(0);
  /**
   * Nguồn của bản đang hiển thị: đổi nguồn — hay đổi ngôn ngữ tài liệu (FLF-265) — là đổi hẳn tài liệu, không phải tải
   * lại cùng một tài liệu.
   */
  const sourceRef = useRef("");

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    const key = `${source}:${baselineId ?? ""}:${language ?? ""}`;
    if (sourceRef.current !== key) {
      sourceRef.current = key;
      setDocument(null);
      setMeta(null);
      setTranslation(null);
    }
    setPending(true);
    return getDocument(projectId, source, baselineId)
      .then((res) => {
        if (request !== requestRef.current) return;
        // BUG-31: dự án chưa có nội dung là trạng thái bình thường của một dự án đang làm dở, BE trả 200 + meta.state
        const nothingYet = res.data === null && res.meta?.state === "not_assembled";
        setDocument(res.data);
        setMeta(isDraftMeta(res.meta) ? res.meta : null);
        setTranslation(translationMetaOf(res.meta));
        setEmpty(nothingYet);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request !== requestRef.current) return;
        setDocument(null);
        setMeta(null);
        setTranslation(null);
        setEmpty(false);
        setError(userErrorMessage(err, "Không tải được tài liệu"));
      })
      .finally(() => {
        if (request === requestRef.current) setPending(false);
      });
  }, [projectId, source, baselineId, language]);

  useEffect(() => {
    if (!projectId) return;
    // Lùi một microtask: `reload()` tự `setPending(true)` đồng bộ (T1) — gọi thẳng trong effect bị
    // lint `react-hooks/set-state-in-effect` chặn (cùng pattern `EditHistory.tsx`).
    queueMicrotask(() => void reload());
  }, [projectId, reload, refreshToken]);

  return { document, meta, translation, loading: pending && document === null, refreshing: pending && document !== null, empty, error, reload };
}
