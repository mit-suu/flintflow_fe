"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "soon";

interface BadgeProps {
  tone?: BadgeTone;
  /** Chấm màu đầu nhãn (badge trạng thái card). */
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Tone `soon` có nhãn mặc định lấy từ `app.common.soon`. */
  children?: ReactNode;
}

const TONE: Record<BadgeTone, { box: string; dot: string }> = {
  neutral: { box: "bg-surface-container-high text-on-surface-variant", dot: "bg-on-surface-muted" },
  primary: { box: "bg-primary-soft text-primary-hover", dot: "bg-primary" },
  success: { box: "bg-success-soft text-success", dot: "bg-success-dark" },
  warning: { box: "bg-accent-gold-soft text-accent-gold-text", dot: "bg-accent-gold" },
  danger: { box: "bg-error-container text-error", dot: "bg-error" },
  info: { box: "bg-info-soft text-info", dot: "bg-info" },
  soon: { box: "bg-surface-container-high text-on-surface-muted", dot: "bg-on-surface-subtle" },
};

/**
 * Pill nhãn dùng chung: trạng thái card, tone theo source mode, và `tone="soon"` cho mọi tính năng chưa có
 * (sidebar, thẻ mode chưa hỗ trợ) — không viết tay badge "Sắp có" ở từng chỗ.
 */
export default function Badge({ tone = "neutral", dot = false, size = "sm", className, children }: BadgeProps) {
  const t = useTranslations("app.common");
  const styles = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap ${size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"} ${styles.box} ${className ?? ""}`}
    >
      {dot && tone !== "soon" && <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      {children ?? (tone === "soon" ? t("soon") : null)}
    </span>
  );
}
