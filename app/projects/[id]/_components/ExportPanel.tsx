"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { downloadPdfExport, downloadWordExport, listBaselines, type ExportFormat } from "@/lib/api/export";
import { shownDocumentLanguage } from "@/lib/document-language";
import { useDocument } from "../hooks/useDocument";
import type { DocumentSource } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import type { Baseline } from "@/types/spine";
import { versionFileName } from "@/types/doc-version";
import type { Flag } from "@/types/flags";
import { userErrorMessage } from "@/lib/api/error-messages";
import { hookErrorText } from "@/lib/hook-errors";

interface ExportPanelProps {
  projectId: string;
  projectName?: string;
  onClose: () => void;
    /** Cờ đang mở, cùng nguồn với Verification panel (BUG-26: hai nơi từng đếm ra hai số khác nhau). */
  flags?: Flag[];
  /** Ngôn ngữ tài liệu client đã biết (FLF-265, `knownDocumentLanguage`) — file .docx ra đúng ngôn ngữ này. */
  documentLanguage?: DocumentLanguage | null;
  /** Mở hộp "Dịch tài liệu" từ cảnh báo mục chưa dịch — chỉ truyền cho Lead/Analyst ở mode 2 (như `DocumentPane`). */
  onTranslate?: () => void;
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

const FORMAT_OPTIONS: ReadonlyArray<{ value: ExportFormat; label: string; extension: string }> = [
  { value: "word", label: "Word", extension: ".docx" },
  { value: "pdf", label: "PDF", extension: ".pdf" },
];

/**
 * Export UI (Phases §6.5): bản nháp (watermark DRAFT) / baseline, mỗi nguồn ra Word hoặc PDF (FLF-316 — PDF là
 * chính file Word chuyển ở BE nên bố cục y hệt).
 */
export default function ExportPanel({ projectId, projectName, onClose, flags, documentLanguage = null, onTranslate }: ExportPanelProps) {
  const t = useTranslations("workspace.export");
  const tHook = useTranslations("workspace.hookErrors");
  const tLanguage = useTranslations("common.documentLanguage");
  const baselineCheckFailed = t("baselineCheckFailed");
  const [source, setSource] = useState<DocumentSource>("draft");
  const [format, setFormat] = useState<ExportFormat>("word");
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineCheckError, setBaselineCheckError] = useState<string | null>(null);
  const hasBaseline = baselines.length > 0;
  // Baseline mới nhất — ExportPanel chưa có bộ chọn version cụ thể (ngoài phạm vi T16). `GET /baselines` trả theo thứ tự
  // ghi, mới nhất ở CUỐI (FLF-318: dự án chuyển đổi release 2.0 sau 1.0 — trước đây lấy nhầm phần tử đầu = 1.0).
  const latestBaseline = baselines.at(-1);
  const baselineId = source === "baseline" ? latestBaseline?.id : undefined;
  const baselineVersion = typeof latestBaseline?.version === "string" ? latestBaseline.version.replace(/^v/, "") : undefined;
  const { document, translation, loading, empty, error } = useDocument(projectId, source, baselineId, 0, documentLanguage);
  // FLF-265: `meta.translation` của chính nguồn đang xem thắng giá trị client tự suy
  const language = shownDocumentLanguage(translation, documentLanguage);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const selectSource = (next: DocumentSource) => {
    setSource(next);
    setDownloadError(null);
  };

  const selectFormat = (next: ExportFormat) => {
    setFormat(next);
    setDownloadError(null);
  };

  const extension = format === "pdf" ? ".pdf" : ".docx";

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
        setBaselineCheckError(userErrorMessage(err, baselineCheckFailed));
      });
    return () => {
      cancelled = true;
    };
    // `baselineCheckFailed` chỉ là câu dự phòng — đổi ngôn ngữ không cần gọi lại BE
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // BUG-26: bản xuất báo "2 cờ đỏ" trong khi Verification panel đếm 10 — hai nguồn khác nhau. Ưu tiên
  // danh sách cờ đang mở mà panel đang dùng; chỉ rơi về phụ lục của bản đã ghép khi chưa có nó.
  // FLF-329: cờ đỏ đã waive (dữ liệu cũ) / giữ nguyên vẫn chặn ⇒ vẫn đếm
  const openRedFlags = flags?.filter((f) => f.level === "red" && !f.resolved_at).length;
  const redCount = openRedFlags ?? document?.flagsAppendix?.redOpen.length ?? 0;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const download = format === "pdf" ? downloadPdfExport : downloadWordExport;
      const { blob, filename } = await download(projectId, source, baselineId);
      // Tên dự phòng khi BE không gửi `Content-Disposition` — cùng quy tắc FLF-334 với BE: baseline ⇒ `_v1.0`, bản nháp ⇒
      // `_v<baseline cuối>_DRAFT` (gốc `0.x` của dự án import ⇒ `v0`), chưa baseline ⇒ `<tên>_DRAFT`
      const draftBase = baselineVersion && /^0(\.\d+)?$/.test(baselineVersion) ? "0" : (baselineVersion ?? null);
      const fallbackName = versionFileName({
        name: projectName ?? t("untitled"),
        release: source === "baseline",
        base: source === "baseline" ? (baselineVersion ?? null) : draftBase,
        ext: format === "pdf" ? "pdf" : "docx",
      });
      triggerDownload(blob, filename ?? fallbackName);
    } catch (err) {
      setDownloadError(
        err instanceof ApiClientError && err.code === "NO_WORKING_DRAFT"
          ? t("noWorkingDraft")
          : userErrorMessage(err, t("downloadFailed"))
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
          <h3 className="font-extrabold text-heading text-[#191817]">{t("title")}</h3>
          <button type="button" onClick={onClose} aria-label={t("close")} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
            ✕
          </button>
        </div>

        <div role="tablist" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={source === "draft"}
            onClick={() => selectSource("draft")}
            className={`px-3 py-1.5 rounded-full text-body font-bold cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-full text-body font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              source === "baseline" ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"
            }`}
          >
            {t("baselineTab")}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span id="export-format-label" className="text-body text-[#4B4842]">
            {t("format")}
          </span>
          <div role="radiogroup" aria-labelledby="export-format-label" className="flex gap-1 p-1 rounded-full bg-[#F0EEEA]">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={format === option.value}
                onClick={() => selectFormat(option.value)}
                className={`px-3 py-1 rounded-full text-body font-bold cursor-pointer ${
                  format === option.value ? "bg-white text-[#191817] shadow-sm" : "text-[#6B6862]"
                }`}
              >
                {option.label} <span className="font-mono font-normal text-caption">{option.extension}</span>
              </button>
            ))}
          </div>
        </div>

        {baselineCheckError && (
          <div className="text-caption text-[#B03030]">{t("baselineCheckFailedWith", { error: baselineCheckError })}</div>
        )}

        {loading && <div className="text-body text-[#A8A49C] italic">{t("loading")}</div>}

        {empty && (
          <div className="bg-[#FBF4E4] border border-[#F0DFB4] rounded-[12px] p-3.5 text-body text-[#6B5A2A]">
            {t("emptySource")}
          </div>
        )}

        {!empty && error && <div className="text-caption text-[#B03030]">{hookErrorText(error, tHook)}</div>}

        {!empty && document && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3.5 flex flex-col gap-1.5 text-body text-[#4B4842]">
            <div className="flex items-center justify-between">
              <span>{t("version")}</span>
              <span className="font-mono font-bold">
                {document.version}
                {source === "draft" ? "-draft" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("redCount")}</span>
              <span className={`font-bold ${redCount > 0 ? "text-[#B03030]" : "text-[#1F7A45]"}`}>{redCount}</span>
            </div>
            {language && (
              <div className="flex items-center justify-between">
                <span>{t("language")}</span>
                <span className="font-bold">
                  {tLanguage(language)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* FLF-265: chỉ báo, KHÔNG chặn tải — mục chưa dịch in chữ gốc trong file (BE không bao giờ dịch lúc xuất) */}
        {!empty && document && translation && translation.missing > 0 && (
          <div role="status" className="bg-accent-gold-soft border border-accent-gold-border rounded-control p-3 text-body text-accent-gold-text leading-relaxed flex flex-col items-start gap-1.5">
            <span>{t("untranslated", { count: translation.missing })}</span>
            {onTranslate && (
              <button type="button" onClick={onTranslate} className="font-bold hover:underline cursor-pointer">
                {t("translateFirst")}
              </button>
            )}
          </div>
        )}

        {downloadError && <div className="text-body text-[#B03030]">{downloadError}</div>}

        <button
          type="button"
          disabled={downloading || empty || loading}
          onClick={() => void handleDownload()}
          className="w-full py-2.5 rounded-[10px] bg-[#191817] text-white text-body font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {downloading
            ? format === "pdf"
              ? t("creatingPdf")
              : t("downloading")
            : source === "draft"
              ? t("downloadDraft", { extension })
              : baselineVersion
                ? t("downloadBaselineVersion", { extension, version: baselineVersion })
                : t("downloadBaseline", { extension })}
        </button>
      </div>
    </div>
  );
}
