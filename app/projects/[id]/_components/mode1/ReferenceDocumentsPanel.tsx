"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { estimateActionCost } from "@/lib/api/chat";
import { summarizeProjectDocuments } from "@/lib/api/documents";
import { estimateExtraction, extractRequirements, getExtraction } from "@/lib/api/extraction";
import type { ProjectDocument } from "@/types/document";
import type { Extraction } from "@/types/extraction";
import ExtractionList from "./ExtractionList";
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
  const [extractions, setExtractions] = useState<Record<string, Extraction | null>>({});
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ documentId: string; cost: number | null; batches: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // FLF-458: AI chỉ đọc tài liệu tham khảo (tóm tắt) sau khi báo credit và người dùng xác nhận — `summaries` ghi đè
  // `summaryStatus` cục bộ sau khi gọi `summarizeProjectDocuments` (danh sách `docs` do nơi gọi tải lại).
  const [confirmSummarize, setConfirmSummarize] = useState<{ documentId: string; cost: number | null } | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ProjectDocument["summaryStatus"]>>({});

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
    // FLF-449: tài liệu dài chia lô, mỗi lô một lượt ⇒ credit = số lô × giá một lượt (BE ước tính); lỗi thì lùi về giá một lượt
    const estimate = await estimateExtraction(projectId, documentId)
      .then((r) => r.data ?? null)
      .catch(() => null);
    if (estimate && estimate.batches > 0) {
      setConfirming({ documentId, cost: estimate.credits, batches: estimate.batches });
      return;
    }
    const cost = await estimateActionCost("extract_requirements")
      .then((r) => r.data?.cost ?? null)
      .catch(() => null);
    setConfirming({ documentId, cost, batches: 1 });
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

  const askSummarize = async (documentId: string) => {
    setError(null);
    const cost = await estimateActionCost("summarize_document")
      .then((r) => r.data?.cost ?? null)
      .catch(() => null);
    setConfirmSummarize({ documentId, cost });
  };

  const runSummarize = async (documentId: string) => {
    setConfirmSummarize(null);
    setSummarizing(documentId);
    setError(null);
    try {
      const res = await summarizeProjectDocuments(projectId, [documentId]);
      const updated = res.data?.find((d) => d._id === documentId);
      if (updated) setSummaries((prev) => ({ ...prev, [documentId]: updated.summaryStatus }));
    } catch (err) {
      setError(L.errorText(err, t("summarizeFailed")));
    } finally {
      setSummarizing(null);
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
          // FLF-458: chưa đọc bằng AI (upload chỉ trích chữ) — người dùng xác nhận credit mới gọi AI tóm tắt
          const summaryStatus = summaries[d._id] ?? d.summaryStatus;
          const pendingSummary = !unreadable && summaryStatus === "pending";
          // FLF-449 việc 27: lý do cụ thể khi BE biết (PDF scan, .doc Word 97-2003), ảnh trong .docx không được đọc
          const warnings = d.parseWarnings ?? [];
          const unreadableLabel = warnings.includes("pdf_no_text")
            ? t("noText")
            : d.parseStatus === "failed" && (d.extension ?? d.originalName.slice(d.originalName.lastIndexOf("."))).toLowerCase() === ".doc"
              ? t("legacyDoc")
              : t("unreadable");
          return (
            <li key={d._id} className="flex flex-wrap items-center gap-2 text-body rounded-inner px-2 py-1.5 odd:bg-surface-container-low">
              {/* Tên giãn theo chỗ trống của dòng, chỉ cắt khi hết chỗ; tên đầy đủ ở tooltip */}
              <span className="font-bold text-on-surface truncate min-w-0 flex-1 basis-[120px]" title={d.originalName}>
                {d.originalName}
              </span>
              {unreadable && <span className="text-caption text-accent-gold-text">{unreadableLabel}</span>}
              {!unreadable && warnings.includes("images_skipped") && <span className="text-caption text-accent-gold-text">{t("imagesSkipped")}</span>}
              {pendingSummary && <span className="text-caption text-on-surface-muted">{t("summaryPending")}</span>}
              {ex && (
                <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${ex.status === "approved" ? "bg-success-soft text-success" : "bg-primary-soft text-primary-hover"}`}>
                  {t(`status.${ex.status}`, { count: ex.items.length })}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                {/* Không có "Xem": web không xem được file gốc (business-flow chỉ có xem chữ + tải file gốc); chữ của
                    tài liệu mở từ chip "Nguồn" tới đúng đoạn được trích */}
                <ReferenceDownloadButton projectId={projectId} documentId={d._id} fallbackName={d.originalName} />
                {pendingSummary && !readOnly && (
                  <button type="button" disabled={summarizing !== null} onClick={() => void askSummarize(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold btn-gradient-primary text-white cursor-pointer disabled:opacity-50">
                    {summarizing === d._id ? t("summarizing") : t("summarize")}
                  </button>
                )}
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
                  <span className="flex-1 min-w-[180px] text-body text-primary-hover">{confirming.cost === null ? t("confirmUnknown") : confirming.batches > 1 ? t("confirmBatches", { batches: confirming.batches, credits: confirming.cost }) : t("confirm", { credits: confirming.cost })}</span>
                  <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-lowest text-on-surface-variant cursor-pointer">
                    {t("cancel")}
                  </button>
                  <button type="button" onClick={() => void runExtract(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-primary text-white cursor-pointer">
                    {t("run")}
                  </button>
                </div>
              )}
              {confirmSummarize?.documentId === d._id && (
                // §3.6 cổng cứng: báo credit, người dùng xác nhận mới gọi AI đọc tài liệu tham khảo
                <div role="dialog" aria-label={t("confirmSummarizeAria")} className="w-full flex flex-wrap items-center gap-2 rounded-inner bg-primary-soft px-3 py-2">
                  <span className="flex-1 min-w-[180px] text-body text-primary-hover">{confirmSummarize.cost === null ? t("confirmUnknown") : t("confirmSummarize", { credits: confirmSummarize.cost })}</span>
                  <button type="button" onClick={() => setConfirmSummarize(null)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-lowest text-on-surface-variant cursor-pointer">
                    {t("cancel")}
                  </button>
                  <button type="button" onClick={() => void runSummarize(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-primary text-white cursor-pointer">
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
