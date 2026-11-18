"use client";

import { useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { Button } from "@/components/ui";
import GoogleDrivePickButton from "@/components/integrations/GoogleDrivePickButton";
import { GOOGLE_DOC_MIME, type PickedGoogleFile } from "@/lib/google-picker";

/** Giới hạn contract #2 (40 MB, §4.16) — BE vẫn là nơi quyết định (nhận file theo magic bytes, không theo đuôi). */
export const MAX_IMPORT_MB = 40;
export const MAX_IMPORT_BYTES = MAX_IMPORT_MB * 1024 * 1024;

/** Làm tròn lên một chữ số: file vừa quá giới hạn hiện 40.1 MB, không hiện "40 MB lớn hơn 40 MB". */
const toMb = (bytes: number) => Math.ceil((bytes / (1024 * 1024)) * 10) / 10;

interface UploadStepProps {
  onUpload: (file: File) => void;
  busy?: boolean;
  /** Tiêu đề khác cho re-upload. */
  title?: string;
  hint?: string;
  /**
   * Cho chọn Google Doc / .docx trên Google Drive (contract #46) — chỉ truyền ở lần import đầu, không ở tải lại. Bỏ trống ⇒
   * không có nút Google Drive.
   */
  onGoogleImport?: (file: PickedGoogleFile) => void;
}

/** 1.1 Upload .docx (UC-20): kéo thả hoặc chọn file; tuỳ chọn chọn từ Google Drive. */
export default function UploadStep({
  onUpload,
  busy = false,
  title: titleProp,
  hint: hintProp,
  onGoogleImport,
}: UploadStepProps) {
  const t = useTranslations("mode1.uploadStep");
  const title = titleProp ?? t("title");
  const hint = hintProp ?? t("hint", { max: MAX_IMPORT_MB });
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedGoogleFile | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setLocalError(
        t("tooLarge", { name: file.name, size: toMb(file.size), max: MAX_IMPORT_MB })
      );
      return;
    }
    setLocalError(null);
    onUpload(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) pick(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-[18px] border-2 border-dashed px-6 py-10 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer ${
          dragging ? "border-[#6A62C4] bg-[#F2F1FB]" : "border-[#D6D2CB] bg-white hover:border-[#6A62C4]"
        } ${busy ? "opacity-60 cursor-wait" : ""}`}
      >
        <Icon name="upload" size={34} className="text-[#6A62C4]" />
        <p className="font-extrabold text-[#191817] text-heading">{busy ? t("uploading") : title}</p>
        <p className="text-body text-[#8A867E] max-w-[420px] leading-relaxed">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          data-testid="docx-input"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {localError && <p className="text-body text-[#B03030]">{localError}</p>}
      {onGoogleImport &&
        (picked ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#ECEAE5] bg-[#FAF9F7] px-3.5 py-3 text-body text-[#4B4842]">
            <span className="min-w-0 flex-1 truncate">
              {t("picked")}{" "}
              <span className="font-bold text-[#191817]">{picked.name}</span>{" "}
              <span className="text-[#8A867E]">({picked.mimeType === GOOGLE_DOC_MIME ? t("pickedGoogleDoc") : t("pickedWord")})</span>
            </span>
            <button
              type="button"
              aria-label={t("removePicked")}
              disabled={busy}
              onClick={() => setPicked(null)}
              className="p-1 rounded-full text-[#8A867E] hover:bg-[#F0EEEA] cursor-pointer disabled:cursor-not-allowed"
            >
              ✕
            </button>
            <Button loading={busy} disabled={busy} onClick={() => onGoogleImport(picked)}>
              {t("continue")}
            </Button>
          </div>
        ) : (
          <GoogleDrivePickButton onPicked={setPicked} disabled={busy} />
        ))}
    </div>
  );
}
