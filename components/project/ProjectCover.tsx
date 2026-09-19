import type { SourceModeTone } from "@/lib/project-source-mode";

/**
 * Bìa card dự án: một màu trơn thuộc tone của source mode. Sắc độ chọn theo hash của id ⇒ các dự án cùng mode
 * vẫn khác nhau nhưng mỗi dự án cố định qua các lần tải. Chỉ class token, không ảnh.
 */
const SHADES: Record<SourceModeTone, readonly [string, string, string, string]> = {
  primary: ["bg-brand-200", "bg-brand-300", "bg-primary-fixed-dim", "bg-primary-light"],
  info: ["bg-info-border", "bg-info-soft", "bg-brand-200", "bg-success-border"],
  warning: ["bg-accent-gold-border", "bg-accent-gold-light", "bg-accent-gold-soft", "bg-error-border"],
};

/** Hash chuỗi ổn định (djb2) → chỉ số sắc độ. */
export const coverVariant = (seed: string): number => {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 4;
};

interface ProjectCoverProps {
  seed: string;
  tone: SourceModeTone;
  className?: string;
}

export default function ProjectCover({ seed, tone, className }: ProjectCoverProps) {
  const variant = coverVariant(seed);
  return <div aria-hidden data-cover-variant={variant} className={`${SHADES[tone][variant]} ${className ?? ""}`} />;
}
