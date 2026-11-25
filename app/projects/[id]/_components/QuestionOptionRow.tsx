"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { OptionAnalysisToggle, RecommendationReason } from "@/components/project/OptionAnalysis";
import type { OptionAnalysis } from "@/types/pipeline";

interface QuestionOptionRowProps {
  index: number;
  /** Nhãn đã bỏ đuôi "(Khuyến nghị)" — cờ khuyến nghị đi riêng thành badge. */
  label: string;
  description?: string;
  recommended: boolean;
  /** FLF-449: ưu / nhược / rủi ro của phương án — mở xem được, thu gọn mặc định. */
  analysis?: Pick<OptionAnalysis, "pros" | "cons" | "risks">;
  /** Lý do khuyến nghị của câu hỏi — chỉ hiện ở phương án được khuyến nghị. */
  recommendationReason?: string;
  selected: boolean;
  multiple: boolean;
  onToggle: () => void;
  /** Trỏ vào (hover/focus) — để khung preview đổi theo. */
  onFocus: () => void;
}

/**
 * Một lựa chọn của thẻ hỏi: số thứ tự (phím tắt), nhãn đậm, badge khuyến nghị, mô tả mờ bên dưới; phương án được khuyến
 * nghị có khối "Vì sao khuyến nghị"; nút "Xem ưu, nhược" mở danh sách ưu / nhược / rủi ro (nằm ngoài nút chọn).
 */
export default function QuestionOptionRow({
  index,
  label,
  description,
  recommended,
  analysis,
  recommendationReason,
  selected,
  multiple,
  onToggle,
  onFocus,
}: QuestionOptionRowProps) {
  const t = useTranslations("workspace.questionStepper");
  const reason = recommended ? recommendationReason?.trim() : undefined;
  return (
    <div
      onMouseEnter={onFocus}
      className={`flex flex-col rounded-control transition-colors ${selected ? "bg-primary-soft" : "hover:bg-surface-container"}`}
    >
      <button
        type="button"
        role={multiple ? "checkbox" : "radio"}
        aria-checked={selected}
        onClick={onToggle}
        onFocus={onFocus}
        className="w-full flex items-start gap-2 px-2 py-1 rounded-control text-left cursor-pointer"
      >
        <span
          aria-hidden
          className={`w-5 h-5 shrink-0 grid place-items-center rounded-inner text-caption font-bold tabular-nums transition-colors ${
            selected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
          }`}
        >
          {selected && multiple ? <Icon name="check" size={12} weight="bold" /> : index + 1}
        </span>
        <span className="flex-1 min-w-0 flex flex-col pt-[2px]">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`text-body font-semibold leading-snug ${selected ? "text-primary-hover" : "text-on-surface"}`}>{label}</span>
            {recommended && (
              <span className="px-1.5 py-px rounded-full bg-success-soft text-success text-caption font-bold leading-4">{t("recommended")}</span>
            )}
          </span>
          {description && <span className="text-caption text-on-surface-muted leading-snug">{description}</span>}
        </span>
      </button>
      {(reason || analysis) && (
        // Thụt thẳng hàng với nhãn (ô số 20px + khe 8px + lề 8px)
        <div className="flex flex-col gap-1 pl-9 pr-2 pb-1 empty:hidden">
          {reason && <RecommendationReason reason={reason} />}
          {analysis && <OptionAnalysisToggle option={analysis} label={label} />}
        </div>
      )}
    </div>
  );
}
