"use client";

import type { ReactNode } from "react";

export type QuickReplyTone = "primary" | "soft" | "warn";

const TONE: Record<QuickReplyTone, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  soft: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  warn: "bg-accent-gold-soft text-accent-gold-text hover:bg-accent-gold-soft/70",
};

interface QuickReplyChipProps {
  children: ReactNode;
  onClick: () => void;
  tone?: QuickReplyTone;
  disabled?: boolean;
  /** Đang xử lý: chip khoá và hiện spinner nhưng giữ nguyên kích thước. */
  busy?: boolean;
  ariaLabel?: string;
  title?: string;
}

/**
 * Chip trả lời nhanh dưới một tin AI (cổng chốt, cờ mới). Cùng kiểu chip với `ChatOpening`: nền fill, không viền, cao
 * ≥ 36px, viền focus chỉ hiện khi dùng bàn phím.
 */
export function QuickReplyChip({ children, onClick, tone = "soft", disabled = false, busy = false, ariaLabel, title }: QuickReplyChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      title={title}
      className={`min-h-9 px-3.5 py-1.5 rounded-control text-[12.5px] font-semibold text-left cursor-pointer transition-colors duration-150 inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      {busy && <span aria-hidden className="size-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner" />}
      {children}
    </button>
  );
}

/** Hàng chip: khoảng cách 8px, xuống dòng khi khung hẹp. */
export default function QuickReplyChips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  );
}
