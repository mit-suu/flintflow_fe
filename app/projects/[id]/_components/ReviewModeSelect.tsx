"use client";

import { useTranslations } from "next-intl";
import type { ReviewMode } from "@/types/spine";

interface ReviewModeSelectProps {
  value: ReviewMode;
  onChange: (mode: ReviewMode) => void;
  disabled?: boolean;
}

/**
 * Mức duyệt 3 tầng (FLF-337, business-flow §1.2): tên nói thẳng lúc nào AI dừng chờ duyệt — Mọi bước · Cuối giai đoạn · Chỉ ở
 * mốc chốt. Hỏi nhiều hay ít là việc của AI, không phải một chế độ (FLF-220); mức duyệt không bao giờ do độ tự tin của AI.
 */
/** Nhãn + gợi ý ở `workspace.aiSettings.modes` / `hints`. */
export const REVIEW_OPTIONS = ["strict", "fast", "milestones"] as const satisfies readonly ReviewMode[];
export type ReviewOption = (typeof REVIEW_OPTIONS)[number];

/** `balanced` (mặc định của schema, dữ liệu cũ) được BE xử lý như `fast` ⇒ hiển thị là "Cuối giai đoạn". */
export const displayReviewMode = (mode: ReviewMode): ReviewOption => (mode === "strict" ? "strict" : mode === "milestones" ? "milestones" : "fast");

/** Cách duyệt (`project.review_mode`) — segmented control trong menu cài đặt AI ở ô chat. */
export default function ReviewModeSelect({ value: raw, onChange, disabled = false }: ReviewModeSelectProps) {
  const t = useTranslations("workspace.aiSettings");
  const value = displayReviewMode(raw);
  return (
    <div role="radiogroup" aria-label={t("heading")} className="flex items-center gap-0.5 bg-surface-container-high rounded-control p-1">
      {REVIEW_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          title={t(`hints.${option}`)}
          onClick={() => value !== option && onChange(option)}
          className={`flex-1 h-7 px-1.5 rounded-inner text-body font-bold text-center whitespace-nowrap transition-colors ${
            value === option ? "bg-surface-container-lowest text-on-surface" : "text-on-surface-variant hover:text-on-surface"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {t(`modes.${option}`)}
        </button>
      ))}
    </div>
  );
}
