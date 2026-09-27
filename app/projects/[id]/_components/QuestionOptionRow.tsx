"use client";

import Icon from "@/components/ui/Icon";

interface QuestionOptionRowProps {
  index: number;
  /** Nhãn đã bỏ đuôi "(Khuyến nghị)" — cờ khuyến nghị đi riêng thành badge. */
  label: string;
  description?: string;
  recommended: boolean;
  selected: boolean;
  multiple: boolean;
  onToggle: () => void;
  /** Trỏ vào (hover/focus) — để khung preview đổi theo. */
  onFocus: () => void;
}

/** Một lựa chọn của thẻ hỏi: số thứ tự (phím tắt), nhãn đậm, badge khuyến nghị, mô tả mờ bên dưới. */
export default function QuestionOptionRow({ index, label, description, recommended, selected, multiple, onToggle, onFocus }: QuestionOptionRowProps) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onToggle}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      className={`w-full flex items-start gap-2.5 px-2 py-1.5 rounded-control text-left transition-colors cursor-pointer ${
        selected ? "bg-primary-soft" : "hover:bg-surface-container"
      }`}
    >
      <span
        aria-hidden
        className={`w-6 h-6 shrink-0 grid place-items-center rounded-inner text-[11px] font-bold tabular-nums transition-colors ${
          selected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
        }`}
      >
        {selected && multiple ? <Icon name="check" size={12} weight="bold" /> : index + 1}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5 pt-[3px]">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[12.5px] font-semibold leading-snug ${selected ? "text-primary-hover" : "text-on-surface"}`}>{label}</span>
          {recommended && (
            <span className="px-1.5 py-px rounded-full bg-success-soft text-success text-[10px] font-bold leading-4">Khuyến nghị</span>
          )}
        </span>
        {description && <span className="text-[11.5px] text-on-surface-muted leading-snug">{description}</span>}
      </span>
    </button>
  );
}
