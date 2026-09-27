"use client";

import type { ReviewMode } from "@/types/spine";

interface ReviewModeSelectProps {
  value: ReviewMode;
  onChange: (mode: ReviewMode) => void;
  disabled?: boolean;
}

/** Tên nói thẳng lúc nào AI dừng chờ duyệt. Hỏi nhiều hay ít là việc của AI, không phải một chế độ (FLF-220). */
export const REVIEW_OPTIONS: { value: ReviewMode; label: string; hint: string }[] = [
  { value: "strict", label: "Mọi bước", hint: "Dừng chờ bạn duyệt ở mọi bước." },
  { value: "fast", label: "Cuối giai đoạn", hint: "Tự duyệt trong giai đoạn; dừng ở cuối giai đoạn, cuối mỗi màn và khi cần bạn quyết." },
];

/** `balanced` (mặc định của schema, dữ liệu cũ) được BE xử lý như `fast` ⇒ hiển thị là "Cuối giai đoạn". */
export const displayReviewMode = (mode: ReviewMode): ReviewMode => (mode === "balanced" ? "fast" : mode);

/** Cách duyệt (`project.review_mode`) — segmented control trong menu cài đặt AI ở ô chat. */
export default function ReviewModeSelect({ value: raw, onChange, disabled = false }: ReviewModeSelectProps) {
  const value = displayReviewMode(raw);
  return (
    <div role="radiogroup" aria-label="AI dừng chờ duyệt" className="flex items-center gap-0.5 bg-surface-container-high rounded-control p-1">
      {REVIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          title={option.hint}
          onClick={() => value !== option.value && onChange(option.value)}
          className={`flex-1 h-7 px-1.5 rounded-inner text-[12px] font-bold text-center whitespace-nowrap transition-colors ${
            value === option.value ? "bg-surface-container-lowest text-on-surface" : "text-on-surface-variant hover:text-on-surface"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
