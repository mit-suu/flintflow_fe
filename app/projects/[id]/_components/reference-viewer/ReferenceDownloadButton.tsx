"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { downloadReferenceDocument } from "@/lib/api/documents";
import { saveBlob } from "@/lib/api/files";

interface ReferenceDownloadButtonProps {
  projectId: string;
  documentId: string;
  /** Tên lưu khi BE không gửi `Content-Disposition`. */
  fallbackName: string;
  className?: string;
}

/** Tải file gốc của tài liệu tham khảo (FLF-443, BE stream; tên tiếng Việt lấy từ `filename*`). */
export default function ReferenceDownloadButton({ projectId, documentId, fallbackName, className }: ReferenceDownloadButtonProps) {
  const t = useTranslations("workspace.referenceViewer");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { blob, filename } = await downloadReferenceDocument(projectId, documentId);
      saveBlob(blob, filename ?? fallbackName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {failed && (
        <span role="alert" className="text-caption text-error">
          {t("downloadFailed")}
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className={
          className ??
          "px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
        }
      >
        {busy ? t("downloading") : t("download")}
      </button>
    </span>
  );
}
