import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

interface BackLinkProps {
  href: string;
  children: ReactNode;
  /** Nền của chip: `surface` khi đặt trên nền trắng, `white` khi đặt trên nền kem / xám. */
  tone?: "surface" | "white";
  className?: string;
}

/**
 * Nút "quay lại" dùng chung cả app: viên thuốc phẳng, mũi tên trong chấm tròn bên trái; hover mũi tên lùi nhẹ.
 * Thay cho link chữ "← …" rải rác ở từng trang.
 */
export default function BackLink({ href, children, tone = "surface", className = "" }: BackLinkProps) {
  const fill =
    tone === "white"
      ? "bg-surface-container-lowest hover:bg-surface-container-low"
      : "bg-surface-container hover:bg-surface-container-high";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 self-start rounded-full py-1 pl-1 pr-3.5 text-[13px] font-semibold text-on-surface-medium transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${fill} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-6 place-items-center rounded-full transition-transform duration-200 group-hover:-translate-x-0.5 ${
          tone === "white" ? "bg-surface-container" : "bg-surface-container-lowest"
        }`}
      >
        <Icon name="caret-left" size={13} weight="bold" />
      </span>
      {children}
    </Link>
  );
}
