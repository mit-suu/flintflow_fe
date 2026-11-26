"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { getReferenceDocumentText } from "@/lib/api/documents";
import type { ReferenceDocumentText } from "@/types/document";
import ReferenceDownloadButton from "./ReferenceDownloadButton";

export interface ReferenceViewerTarget {
  documentId: string;
  /** Tên hiển thị khi chữ chưa về (tên thật lấy từ BE). */
  name?: string | null;
  /** Đoạn cần nhảy tới và tô (`D1-P03`). */
  focusParaId?: string | null;
}

interface ReferenceDocumentViewerProps {
  projectId: string;
  target: ReferenceViewerTarget | null;
  onClose: () => void;
}

/** `D1-P03` ⇒ 3; sai khuôn ⇒ null. */
const paragraphNumber = (paraId: string): number | null => {
  const m = /^D\d+-P(\d+)$/.exec(paraId);
  return m ? Number(m[1]) : null;
};

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; doc: ReferenceDocumentText };

/**
 * Xem chữ của tài liệu tham khảo (FLF-443): các đoạn theo mã của `GET /sources`; mở từ chip "Nguồn" thì cuộn tới đúng đoạn
 * và tô; đoạn không còn (tài liệu đã thay) ⇒ mở đầu tài liệu kèm một dòng báo.
 */
export default function ReferenceDocumentViewer({ projectId, target, onClose }: ReferenceDocumentViewerProps) {
  const t = useTranslations("workspace.referenceViewer");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const focusRef = useRef<HTMLLIElement | null>(null);
  const documentId = target?.documentId ?? null;

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    // Lùi một microtask: đặt state đồng bộ trong effect bị lint `react-hooks/set-state-in-effect` chặn
    queueMicrotask(() => !cancelled && setState({ status: "loading" }));
    getReferenceDocumentText(projectId, documentId)
      .then((res) => !cancelled && setState(res.data ? { status: "ready", doc: res.data } : { status: "error" }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [projectId, documentId]);

  const focusParaId = target?.focusParaId ?? null;
  const ready = state.status === "ready" ? state.doc : null;
  const focusFound = !!ready && !!focusParaId && ready.paragraphs.some((p) => p.para_id === focusParaId);

  useEffect(() => {
    // `?.` trên chính hàm: jsdom không có `scrollIntoView`
    if (focusFound) focusRef.current?.scrollIntoView?.({ block: "center" });
  }, [focusFound, ready]);

  if (!target) return null;
  const title = ready?.name ?? target.name ?? "";

  // Mở từ danh sách tài liệu (không có đoạn cần nhảy tới) ⇒ đọc liền như một trang; mã đoạn chỉ có nghĩa khi mở từ chip "Nguồn"
  const reading = !focusParaId;

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <ReferenceDownloadButton projectId={projectId} documentId={target.documentId} fallbackName={title} />
        </div>
        {state.status === "loading" && <p className="text-body text-on-surface-variant">{t("loading")}</p>}
        {state.status === "error" && (
          <p role="alert" className="text-body text-error">
            {t("loadFailed")}
          </p>
        )}
        {ready && (
          <>
            {focusParaId && !focusFound && <p className="rounded-inner bg-surface-container-low px-3 py-2 text-body text-on-surface-variant">{t("paragraphMissing")}</p>}
            {ready.paragraphs.length === 0 ? (
              <p className="text-body text-on-surface-variant">{t("empty")}</p>
            ) : reading ? (
              <article className="ff-scroll max-h-[60vh] overflow-y-auto flex flex-col gap-3 pr-1" aria-label={title}>
                {ready.paragraphs.map((p) => (
                  <p key={p.para_id} data-para-id={p.para_id} className="text-body text-on-surface leading-relaxed whitespace-pre-line">
                    {p.text}
                  </p>
                ))}
              </article>
            ) : (
              <ol className="ff-scroll max-h-[60vh] overflow-y-auto flex flex-col gap-2 pr-1">
                {ready.paragraphs.map((p) => {
                  const focused = p.para_id === focusParaId;
                  const n = paragraphNumber(p.para_id);
                  return (
                    <li
                      key={p.para_id}
                      ref={focused ? focusRef : undefined}
                      data-para-id={p.para_id}
                      aria-current={focused ? "true" : undefined}
                      className={`rounded-inner px-3 py-2 flex flex-col gap-0.5 ${focused ? "bg-primary-soft" : ""}`}
                    >
                      <span className="text-caption text-on-surface-muted">{n === null ? p.para_id : t("paragraph", { n })}</span>
                      <p className="text-body text-on-surface leading-relaxed whitespace-pre-line">{p.text}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
