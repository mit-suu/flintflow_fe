interface CountBadgeProps {
  count: number;
  /** `alert`: nền đỏ cho số chưa đọc; `neutral`: số đếm thường (tổng dự án). */
  tone?: "neutral" | "alert";
  max?: number;
  className?: string;
}

/** Số đếm nhỏ cạnh nhãn (tổng dự án, thông báo chưa đọc). */
export default function CountBadge({ count, tone = "neutral", max = 99, className }: CountBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10.5px] font-extrabold tabular-nums ${
        tone === "alert" ? "bg-error text-on-error" : "bg-surface-container-highest text-on-surface-variant"
      } ${className ?? ""}`}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
