"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { estimateActionCost } from "@/lib/api/chat";
import { deleteProjectDocument, listProjectDocuments } from "@/lib/api/documents";
import { extractRequirements, getExtraction } from "@/lib/api/extraction";
import type { ProjectDocument } from "@/types/document";
import type { Extraction } from "@/types/extraction";
import ExtractionList from "./ExtractionList";
import { useMode1Labels } from "./i18n";

interface ReferenceDocumentsPanelProps {
  projectId: string;
  /** Sau khi duyệt danh sách (CR đã tạo). */
  onCrsCreated: () => void;
  readOnly?: boolean;
}

/**
 * Tài liệu tham khảo của dự án (biên bản, email đính kèm trong chat) + "Rút yêu cầu" (FLF-338 §3.6.1): báo credit trước (cổng
 * cứng §3.6) ⇒ AI rút danh sách ⇒ `ExtractionList` để BA duyệt. Tài liệu đã có danh sách thì hiện lại.
 */
export default function ReferenceDocumentsPanel({ projectId, onCrsCreated, readOnly = false }: ReferenceDocumentsPanelProps) {
  const t = useTranslations("mode1.referenceDocs");
  const L = useMode1Labels();
  const [docs, setDocs] = useState<ProjectDocument[] | null>(null);
  const [extractions, setExtractions] = useState<Record<string, Extraction | null>>({});
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ documentId: string; cost: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listProjectDocuments(projectId);
      const list = res.data ?? [];
      setDocs(list);
      const pairs = await Promise.all(list.map(async (d) => [d._id, (await getExtraction(projectId, d._id).catch(() => ({ data: null }))).data ?? null] as const));
      setExtractions(Object.fromEntries(pairs));
    } catch (err) {
      setError(L.errorText(err, t("loadFailed")));
    }
    // `L` đổi tham chiếu mỗi render — chỉ tải lại theo project
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // Lùi một microtask: `load()` không đặt state đồng bộ trong effect (react-hooks/set-state-in-effect)
    void Promise.resolve().then(load);
  }, [load]);

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
    try {
      await deleteProjectDocument(projectId, documentId);
      setDocs((prev) => (prev ?? []).filter((d) => d._id !== documentId));
      if (openDoc === documentId) setOpenDoc(null);
    } catch (err) {
      setError(L.errorText(err, t("deleteFailed")));
    } finally {
      setBusy(null);
    }
  };

  if (docs === null && !error) return <p className="text-body text-[#8A867E]">{t("loading")}</p>;
  if (docs && docs.length === 0 && !error) return null;

  return (
    <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-3" aria-label={t("aria")}>
      <div>
        <h3 className="text-body font-extrabold text-[#191817]">{t("title")}</h3>
        <p className="text-caption text-[#8A867E]">{t("intro")}</p>
      </div>
      {error && (
        <p role="alert" className="text-body text-[#B03030]">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {(docs ?? []).map((d) => {
          const ex = extractions[d._id] ?? null;
          const unreadable = d.parseStatus !== "success";
          return (
            <li key={d._id} className="flex flex-wrap items-center gap-2 text-body">
              <span className="font-bold text-[#191817] truncate max-w-[280px]">{d.originalName}</span>
              {unreadable && <span className="text-caption text-[#8A6D1F]">{t("unreadable")}</span>}
              {ex && (
                <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${ex.status === "approved" ? "bg-[#E9F7EE] text-[#1F7A45]" : "bg-[#F2F1FB] text-[#554DB0]"}`}>
                  {t(`status.${ex.status}`, { count: ex.items.length })}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                {ex && (
                  <button type="button" onClick={() => setOpenDoc(openDoc === d._id ? null : d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold border border-[#ECEAE5] bg-white text-[#4B4842] cursor-pointer">
                    {openDoc === d._id ? t("hide") : t("show")}
                  </button>
                )}
                {!readOnly && !unreadable && ex?.status !== "approved" && (
                  <button type="button" disabled={busy !== null} onClick={() => void askExtract(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold btn-gradient-primary text-white cursor-pointer disabled:opacity-50">
                    {busy === d._id ? t("extracting") : ex ? t("reExtract") : t("extract")}
                  </button>
                )}
                {!readOnly && ex?.status !== "approved" && (
                  <button type="button" disabled={busy !== null} onClick={() => void remove(d._id)} className="text-caption font-bold text-[#8A867E] underline cursor-pointer disabled:opacity-50">
                    {t("delete")}
                  </button>
                )}
              </span>
              {confirming?.documentId === d._id && (
                // §3.6 cổng cứng: báo credit, người dùng xác nhận mới gọi AI
                <div role="dialog" aria-label={t("confirmAria")} className="w-full flex flex-wrap items-center gap-2 rounded-[10px] bg-[#F2F1FB] border border-[#DCD8F0] px-3 py-2">
                  <span className="flex-1 min-w-[200px] text-body text-[#554DB0]">{confirming.cost === null ? t("confirmUnknown") : t("confirm", { credits: confirming.cost })}</span>
                  <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1 rounded-full text-caption font-bold border border-[#DCD8F0] bg-white text-[#4B4842] cursor-pointer">
                    {t("cancel")}
                  </button>
                  <button type="button" onClick={() => void runExtract(d._id)} className="px-2.5 py-1 rounded-full text-caption font-bold bg-[#6A62C4] text-white cursor-pointer">
                    {t("run")}
                  </button>
                </div>
              )}
              {openDoc === d._id && ex && (
                <div className="w-full border-t border-[#ECEAE5] pt-3">
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
    </section>
  );
}
