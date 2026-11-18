"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { estimateActionCost } from "@/lib/api/chat";
import { extractRequirements, getExtraction } from "@/lib/api/extraction";
import type { ProjectDocument } from "@/types/document";
import type { Extraction } from "@/types/extraction";
import ExtractionList from "./ExtractionList";
import { useReferenceViewer } from "../reference-viewer/ReferenceViewerProvider";
import ReferenceDownloadButton from "../reference-viewer/ReferenceDownloadButton";
import { useMode1Labels } from "./i18n";

interface ReferenceDocumentsPanelProps {
  projectId: string;
  /** Danh sách tài liệu tham khảo (nơi gọi tải qua `useProjectDocuments`). */
  docs: ProjectDocument[];
  /** Xoá trên BE rồi bỏ khỏi danh sách; lỗi ném lại để hiện ở đây. */
  onRemove: (documentId: string) => Promise<void>;
  /** Sau khi duyệt danh sách (CR đã tạo). */
  onCrsCreated: () => void;
  readOnly?: boolean;
  /**
   * Có nút "Rút yêu cầu" không. Duyệt danh sách rút là tạo change request (`POST .../extraction` thuộc luồng CR, chỉ có ở
   * dự án nhập SRS) ⇒ dự án AI soạn chỉ xem / xoá tài liệu.
   */
  canExtract?: boolean;
}

/**
 * Tài liệu tham khảo của dự án (biên bản, email đính kèm trong chat) + "Rút yêu cầu" (FLF-338 §3.6.1): báo credit trước (cổng
 * cứng §3.6) ⇒ AI rút danh sách ⇒ `ExtractionList` để BA duyệt. Tài liệu đã có danh sách thì hiện lại.
 */
export default function ReferenceDocumentsPanel({ projectId, docs, onRemove, onCrsCreated, readOnly = false, canExtract = true }: ReferenceDocumentsPanelProps) {
  const t = useTranslations("mode1.referenceDocs");
  const L = useMode1Labels();
  // FLF-443: xem chữ / tải file gốc (mọi chế độ). Ngoài provider của workspace thì không có nút "Xem"
  const viewer = useReferenceViewer();
  const [extractions, setExtractions] = useState<Record<string, Extraction | null>>({});
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ documentId: string; cost: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Danh sách rút đã có của từng tài liệu — chỉ khi dự án có luồng rút yêu cầu
  const docIds = docs.map((d) => d._id).join(",");
  useEffect(() => {
    if (!canExtract || !docIds) return;
    let cancelled = false;
    void Promise.all(docIds.split(",").map(async (id) => [id, (await getExtraction(projectId, id).catch(() => ({ data: null }))).data ?? null] as const)).then(
      (pairs) => !cancelled && setExtractions(Object.fromEntries(pairs)),
    );
    return () => {
      cancelled = true;
    };
  }, [projectId, docIds, canExtract]);

  const askExtract = async (documentId: string) => {
    setError(null);
    const cost = await estimateActionCost("extract_requirements")
      .then((r) => r.data?.cost ?? null)
      .catch(() => null);
    setConfirming({ documentId, cost });
  };

  const runExtract = async (documentId: string) => {
    setConfirming(null);
    setBusy(documentId);
    setError(null);
    try {
      const res = await extractRequirements(projectId, documentId);
      if (res.data) {
        setExtractions((prev) => ({ ...prev, [documentId]: res.data }));
        setOpenDoc(documentId);
      }
    } catch (err) {
      setError(L.errorText(err, t("extractFailed")));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (documentId: string) => {
    setBusy(documentId);
    setError(null);
    try {
      await onRemove(documentId);
      if (openDoc === documentId) setOpenDoc(null);
    } catch (err) {
      setError(L.errorText(err, t("deleteFailed")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="group" className="flex flex-col gap-2" aria-label={t("aria")}>
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {docs.map((d) => {
          const ex = extractions[d._id] ?? null;
          const unreadable = d.parseStatus !== "success";
          return (
            <li key={d._id} className="flex flex-wrap items-center gap-2 text-body rounded-inner px-2 py-1.5 odd:bg-surface-container-low">
              <span className="font-bold text-on-surface truncate min-w-0 max-w-[200px]" title={d.originalName}>
                {d.originalName}
              </span>
              {unreadable && <span className="text-caption text-accent-gold-text">{t("unreadable")}</span>}
              {ex && (
                <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${ex.status === "approved" ? "bg-success-soft text-success" : "bg-primary-soft text-primary-hover"}`}>
                  {t(`status.${ex.status}`, { count: ex.items.length })}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                {viewer && !unreadable && (
                  <button
                    type="button"
                    onClick={() => viewer.openDocument({ documentId: d._id, name: d.originalName })}
                    className="px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest cursor-pointer"
                  >
                    {t("view")}
                  </button>
                )}
                <ReferenceDownloadButton projectId={projectId} documentId={d._id} fallbackName={d.originalName} />
                {ex && (
                  <button type="button" onClick={() => setOpenDoc(openDoc === d._id ? null : d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest cursor-pointer">
                    {openDoc === d._id ? t("hide") : t("show")}
                  </button>
                )}
                {canExtract && !readOnly && !unreadable && ex?.status !== "approved" && (
                  <button type="button" disabled={busy !== null} onClick={() => void askExtract(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold btn-gradient-primary text-white cursor-pointer disabled:opacity-50">
                    {busy === d._id ? t("extracting") : ex ? t("reExtract") : t("extract")}
                  </button>
                )}
                {!readOnly && ex?.status !== "approved" && (
                  <button type="button" disabled={busy !== null} onClick={() => void remove(d._id)} className="text-caption font-bold text-on-surface-muted underline cursor-pointer disabled:opacity-50">
                    {t("delete")}
                  </button>
                )}
              </span>
              {confirming?.documentId === d._id && (
                // §3.6 cổng cứng: báo credit, người dùng xác nhận mới gọi AI
                <div role="dialog" aria-label={t("confirmAria")} className="w-full flex flex-wrap items-center gap-2 rounded-inner bg-primary-soft px-3 py-2">
                  <span className="flex-1 min-w-[180px] text-body text-primary-hover">{confirming.cost === null ? t("confirmUnknown") : t("confirm", { credits: confirming.cost })}</span>
                  <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-lowest text-on-surface-variant cursor-pointer">
                    {t("cancel")}
                  </button>
                  <button type="button" onClick={() => void runExtract(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-primary text-white cursor-pointer">
                    {t("run")}
                  </button>
                </div>
              )}
              {openDoc === d._id && ex && (
                <div className="w-full pt-2">
                  <ExtractionList
                    projectId={projectId}
                    extraction={ex}
                    readOnly={readOnly}
                    onApproved={(approved) => {
                      setExtractions((prev) => ({ ...prev, [d._id]: approved }));
                      onCrsCreated();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
