import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Đổ bóng khi hover (card bấm được). */
  interactive?: boolean;
  children: ReactNode;
}

/** Khối nền trắng bo 16px, viền mảnh — nền của card dự án, thẻ mode, panel. */
export default function Card({ interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant rounded-[16px] ${
        interactive ? "transition-shadow hover:shadow-[0_12px_32px_rgba(25,24,23,0.08)]" : ""
      } ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
