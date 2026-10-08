"use client";

import { useRef, useState, type DragEvent } from "react";
import Icon from "@/components/ui/Icon";

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
}

/** 1.1 Upload .docx (UC-20): kéo thả hoặc chọn file. */
export default function UploadStep({
  onUpload,
  busy = false,
  title = "Tải lên SRS có sẵn (.docx)",
  hint = `File Word .docx tối đa ${MAX_IMPORT_MB} MB. Track Changes/comment của người khác phải được Accept/Reject trước khi tải lên.`,
}: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setLocalError(
        `File ${file.name} nặng ${toMb(file.size)} MB, lớn hơn giới hạn ${MAX_IMPORT_MB} MB — hãy nén ảnh trong Word (File → Compress Pictures) hoặc tách phụ lục rồi thử lại.`
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
        <p className="font-extrabold text-[#191817] text-heading">{busy ? "Đang tải lên và kiểm tra file…" : title}</p>
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
    </div>
  );
}
