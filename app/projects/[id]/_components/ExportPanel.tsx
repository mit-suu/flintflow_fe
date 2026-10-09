"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { downloadWordExport, listBaselines } from "@/lib/api/export";
import { DOCUMENT_LANGUAGE_NAME, shownDocumentLanguage } from "@/lib/document-language";
import { useDocument } from "../hooks/useDocument";
import type { DocumentSource } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import type { Baseline } from "@/types/spine";
import type { Flag } from "@/types/flags";
import { userErrorMessage } from "@/lib/api/error-messages";

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

/** Export UI (Phases §6.5): Word draft (watermark DRAFT) / Word baseline. */
export default function ExportPanel({ projectId, projectName = "Dự án", onClose, flags, documentLanguage = null, onTranslate }: ExportPanelProps) {
  const [source, setSource] = useState<DocumentSource>("draft");
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineCheckError, setBaselineCheckError] = useState<string | null>(null);
  const hasBaseline = baselines.length > 0;
  // Baseline mới nhất — ExportPanel chưa có bộ chọn version cụ thể (ngoài phạm vi T16).
  const baselineId = source === "baseline" ? baselines[0]?.id : undefined;
  const { document, translation, loading, empty, error } = useDocument(projectId, source, baselineId, 0, documentLanguage);
  // FLF-265: `meta.translation` của chính nguồn đang xem thắng giá trị client tự suy
  const language = shownDocumentLanguage(translation, documentLanguage);
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
        setBaselineCheckError(userErrorMessage(err, "Không kiểm tra được baseline"));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // BUG-26: bản xuất báo "2 cờ đỏ" trong khi Verification panel đếm 10 — hai nguồn khác nhau. Ưu tiên
  // danh sách cờ đang mở mà panel đang dùng; chỉ rơi về phụ lục của bản đã ghép khi chưa có nó.
  const openRedFlags = flags?.filter((f) => f.level === "red" && !f.resolved_at && !f.waived_by_user).length;
  const redCount = openRedFlags ?? document?.flagsAppendix?.redOpen.length ?? 0;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await downloadWordExport(projectId, source, baselineId);
      const suffix = source === "draft" ? "-draft" : "";
      const fallbackName = `${projectName}-${document?.version ?? "v0"}${suffix}.docx`;
      triggerDownload(blob, filename ?? fallbackName);
    } catch (err) {
      setDownloadError(
        err instanceof ApiClientError && err.code === "NO_WORKING_DRAFT"
          ? "Dự án chưa có nội dung nào để xuất ra tài liệu."
          : userErrorMessage(err, "Tải file thất bại")
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
          <h3 className="font-extrabold text-heading text-[#191817]">Xuất tài liệu SRS</h3>
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
            className={`px-3 py-1.5 rounded-full text-body font-bold cursor-pointer ${
              source === "draft" ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"
            }`}
          >
            Word nháp (DRAFT)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "baseline"}
            disabled={!hasBaseline}
            onClick={() => selectSource("baseline")}
            title={hasBaseline ? undefined : "Chưa có baseline nào"}
            className={`px-3 py-1.5 rounded-full text-body font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              source === "baseline" ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"
            }`}
          >
            Word baseline
          </button>
        </div>

        {baselineCheckError && (
          <div className="text-caption text-[#B03030]">Không kiểm tra được baseline: {baselineCheckError}</div>
        )}

        {loading && <div className="text-body text-[#A8A49C] italic">Đang tải thông tin tài liệu…</div>}

        {empty && (
          <div className="bg-[#FBF4E4] border border-[#F0DFB4] rounded-[12px] p-3.5 text-body text-[#6B5A2A]">
            Dự án chưa có nội dung nào để xuất ở nguồn này.
          </div>
        )}

        {!empty && error && <div className="text-caption text-[#B03030]">{error}</div>}

        {!empty && document && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3.5 flex flex-col gap-1.5 text-body text-[#4B4842]">
            <div className="flex items-center justify-between">
              <span>Phiên bản</span>
              <span className="font-mono font-bold">
                {document.version}
                {source === "draft" ? "-draft" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Số cờ đỏ sẽ in vào §I</span>
              <span className={`font-bold ${redCount > 0 ? "text-[#B03030]" : "text-[#1F7A45]"}`}>{redCount}</span>
            </div>
            {language && (
              <div className="flex items-center justify-between">
                <span>Ngôn ngữ</span>
                <span lang={language} className="font-bold">
                  {DOCUMENT_LANGUAGE_NAME[language]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* FLF-265: chỉ báo, KHÔNG chặn tải — mục chưa dịch in chữ gốc trong file (BE không bao giờ dịch lúc xuất) */}
        {!empty && document && translation && translation.missing > 0 && (
          <div role="status" className="bg-accent-gold-soft border border-accent-gold-border rounded-control p-3 text-body text-accent-gold-text leading-relaxed flex flex-col items-start gap-1.5">
            <span>Còn {translation.missing} mục chưa dịch — file sẽ in chữ gốc ở các mục này. Vẫn tải được.</span>
            {onTranslate && (
              <button type="button" onClick={onTranslate} className="font-bold hover:underline cursor-pointer">
                Dịch tài liệu trước
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
          {downloading ? "Đang tải…" : `Tải ${source === "draft" ? "bản nháp" : "bản baseline"} (.docx)`}
        </button>
      </div>
    </div>
  );
}
