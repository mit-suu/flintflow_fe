"use client";

import { useRef, useState, type DragEvent } from "react";

/** Giới hạn contract #2 — BE vẫn là nơi quyết định (nhận file theo magic bytes, không theo đuôi). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

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
  hint = "File Word .docx tối đa 10MB. Track Changes/comment của người khác phải được Accept/Reject trước khi tải lên.",
}: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setLocalError(`File ${file.name} lớn hơn 10MB — hãy nén ảnh hoặc tách phụ lục rồi thử lại.`);
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
        <span className="material-symbols-outlined text-[34px] text-[#6A62C4]">upload_file</span>
        <p className="font-extrabold text-[#191817] text-[14px]">{busy ? "Đang tải lên và kiểm tra file…" : title}</p>
        <p className="text-[12px] text-[#8A867E] max-w-[420px] leading-relaxed">{hint}</p>
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
      {localError && <p className="text-[12px] text-[#B03030]">{localError}</p>}
    </div>
  );
}
