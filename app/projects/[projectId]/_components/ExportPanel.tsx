"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { downloadWordExport, listBaselines } from "@/lib/api/export";
import { hookErrorText } from "@/lib/hook-errors";
import { useDocument } from "../hooks/useDocument";
import type { DocumentSource } from "@/types/document";
import type { Baseline } from "@/types/spine";

interface ExportPanelProps {
  projectId: string;
  projectName?: string;
  onClose: () => void;
  onGoToStep?: (stepId: string) => void;
  /** `spine_version` hiện tại — có thì nút ghép gọi `POST /assemble` thẳng thay vì chỉ chuyển sang S-8.2. */
  getBaseVersion?: () => number | null;
}

/** Ghim thẻ `<a download>` vào DOM trước khi click — Safari/Firefox bỏ qua click trên thẻ rời DOM. */
const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = fileName;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  // Lùi việc revoke ra khỏi tick hiện tại: một số trình duyệt đọc `href` bất đồng bộ sau `click()`.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Export UI (Phases §6.5): Word draft (watermark DRAFT) / Word baseline; hiện lý do khi chưa ghép. */
export default function ExportPanel({ projectId, projectName, onClose, onGoToStep, getBaseVersion }: ExportPanelProps) {
  const t = useTranslations("workspace.export");
  const tDoc = useTranslations("workspace.document");
  const tErr = useTranslations("workspace.hookErrors");
  const [source, setSource] = useState<DocumentSource>("draft");
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineCheckError, setBaselineCheckError] = useState<string | null>(null);
  const hasBaseline = baselines.length > 0;
  // Baseline mới nhất — ExportPanel chưa có bộ chọn version cụ thể (ngoài phạm vi T16).
  const baselineId = source === "baseline" ? baselines[0]?.id : undefined;
  const { document, meta, loading, notAssembled, error, assemble, assembling, assembleError } = useDocument(projectId, source, baselineId);
  // Chỉ bản draft ghép được theo yêu cầu — baseline do S-9.5 ký, không ghép lại từ đây.
  const runAssemble = getBaseVersion && source === "draft" ? () => void assemble(getBaseVersion()) : undefined;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const selectSource = (next: DocumentSource) => {
    setSource(next);
    setDownloadError(null);
  };

  useEffect(() => {
    let cancelled = false;
    listBaselines(projectId)
      .then((res) => {
        if (cancelled) return;
        setBaselines(res.data ?? []);
        setBaselineCheckError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBaselines([]);
        setBaselineCheckError(err instanceof Error ? err.message : "");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const redCount = document?.flagsAppendix?.redOpen.length ?? 0;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await downloadWordExport(projectId, source, baselineId);
      const suffix = source === "draft" ? "-draft" : "";
      const fallbackName = `${projectName ?? tDoc("untitled")}-${document?.version ?? "v0"}${suffix}.docx`;
      triggerDownload(blob, filename ?? fallbackName);
    } catch (err) {
      setDownloadError(
        err instanceof ApiClientError && err.code === "NO_WORKING_DRAFT"
          ? t("noDraft")
          : err instanceof Error
            ? err.message
            : t("downloadFailed")
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-[20px] p-6 w-[440px] max-w-[92vw] shadow-[0_30px_80px_rgba(0,0,0,0.3)] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-[15px] text-[#191817]">{t("title")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
            ✕
          </button>
        </div>

        <div role="tablist" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={source === "draft"}
            onClick={() => selectSource("draft")}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer ${
              source === "draft" ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"
            }`}
          >
            {t("draftTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "baseline"}
            disabled={!hasBaseline}
            onClick={() => selectSource("baseline")}
            title={hasBaseline ? undefined : t("noBaseline")}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              source === "baseline" ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"
            }`}
          >
            {t("baselineTab")}
          </button>
        </div>

        {baselineCheckError !== null && (
          <div className="text-[10.5px] text-[#B03030]">
            {baselineCheckError ? t("baselineCheckFailedWith", { error: baselineCheckError }) : t("baselineCheckFailed")}
          </div>
        )}

        {loading && <div className="text-[12px] text-[#A8A49C] italic">{t("loading")}</div>}

        {!loading && notAssembled && (
          <div className="bg-[#FBF4E4] border border-[#F0DFB4] rounded-[12px] p-3.5 flex flex-col gap-2 text-[11.5px] text-[#6B5A2A]">
            <span>{error ? hookErrorText(error, tErr) : t("notAssembled")}</span>
            {runAssemble ? (
              <button
                type="button"
                onClick={runAssemble}
                disabled={assembling}
                className="self-start px-3 py-1 rounded-full text-[11px] font-bold bg-[#191817] text-white cursor-pointer disabled:opacity-60"
              >
                {assembling ? tDoc("assemblingDoc") : tDoc("assembleNow")}
              </button>
            ) : (
              onGoToStep && (
                <button
                  type="button"
                  onClick={() => {
                    onGoToStep("S-8.2");
                    onClose();
                  }}
                  className="self-start px-3 py-1 rounded-full text-[11px] font-bold bg-[#191817] text-white cursor-pointer"
                >
                  {tDoc("goToAssemble")}
                </button>
              )
            )}
          </div>
        )}

        {assembleError && <div className="text-[10.5px] text-[#B03030]">{tDoc("assembleFailedWith", { error: hookErrorText(assembleError, tErr) })}</div>}

        {!loading && !notAssembled && document && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3.5 flex flex-col gap-1.5 text-[11.5px] text-[#4B4842]">
            <div className="flex items-center justify-between">
              <span>{t("version")}</span>
              <span className="font-mono font-bold">
                {document.version}
                {source === "draft" ? "-draft" : ""}
              </span>
            </div>
            {source === "draft" && (
              <div className="flex items-center justify-between">
                <span>{t("assembledAt", { version: meta?.assembled_at_version ?? "—" })}</span>
                {meta?.stale && <span className="text-[#B03030] font-bold">{t("staleVs", { version: meta.spine_version })}</span>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>{t("redCount")}</span>
              <span className={`font-bold ${redCount > 0 ? "text-[#B03030]" : "text-[#1F7A45]"}`}>{redCount}</span>
            </div>
          </div>
        )}

        {downloadError && <div className="text-[11.5px] text-[#B03030]">{downloadError}</div>}

        <button
          type="button"
          disabled={downloading || notAssembled || loading}
          onClick={() => void handleDownload()}
          className="w-full py-2.5 rounded-[10px] bg-[#191817] text-white text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {downloading ? t("downloading") : source === "draft" ? t("downloadDraft") : t("downloadBaseline")}
        </button>
      </div>
    </div>
  );
}
