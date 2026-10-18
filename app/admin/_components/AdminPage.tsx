"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { X, type LucideIcon } from "lucide-react";
import PageSkeleton, { type PageSkeletonVariant } from "@/components/ui/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";

/**
 * Vùng nội dung của một trang admin — đúng khuôn `Main` của bộ admin gốc: lề 1rem, và khi khung đủ rộng
 * thì giới hạn bề ngang rồi căn giữa để dòng trong bảng không kéo dài hết màn hình lớn.
 *
 * Cột cao bằng khung và không tự cuộn: phần cố định (tiêu đề, thanh lọc) nằm thẳng trong này, phần dài
 * thì bọc `AdminScroll`.
 */
export function AdminMain({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col gap-4 overflow-hidden px-4 py-6 sm:gap-6",
        "@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl",
        className
      )}
    >
      {children}
    </main>
  );
}

/**
 * Phần cuộn được của trang (danh sách dài, thẻ, bảng tự dựng) — những thứ bên ngoài nó thì đứng yên.
 * `ff-scroll` là thanh cuộn custom dùng chung với workspace (`app/globals.css`).
 */
export function AdminScroll({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("ff-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:gap-6", className)}>
      {children}
    </div>
  );
}

/** Tiêu đề trang + một câu mô tả + hành động bên phải. */
export function AdminPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <h1 className="text-title font-extrabold">{title}</h1>
        {description && <p className="text-muted-foreground text-body">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div
      role="alert"
      className="bg-error-container text-on-error-container flex items-center gap-3 rounded-control px-4 py-3 text-body font-medium"
    >
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="cursor-pointer hover:opacity-75">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Thông báo thành công (đổi credit, đổi trạng thái…) — cùng khuôn với `ErrorBanner`. */
export function SuccessBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div
      role="status"
      className="bg-success-soft text-success flex items-center gap-3 rounded-control px-4 py-3 text-body font-medium"
    >
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="cursor-pointer hover:opacity-75">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Giữ chỗ lúc tải nội dung trang admin. `variant` chọn theo hình nội dung thật (bảng, lưới thẻ…) để
 * lúc dữ liệu về không nhảy layout — `label` chỉ dành cho trình đọc màn hình.
 */
export function LoadingBlock({
  label,
  variant = "table",
  rows,
  bare = false,
}: {
  label: string;
  variant?: PageSkeletonVariant;
  rows?: number;
  bare?: boolean;
}) {
  return <PageSkeleton variant={variant} rows={rows} label={label} bare={bare} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  /** Bấm vào đi đâu. Bỏ trống thì ô chỉ là con số. */
  href?: string;
}) {
  const card = (
    <Card className={cn("h-full gap-2", href && "hover:bg-muted/50 transition-colors")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-body font-medium">{label}</CardTitle>
        {Icon && <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      </CardHeader>
      <CardContent>
        <div className="text-metric font-extrabold tabular-nums">{value}</div>
        {hint && <p className="text-muted-foreground text-caption">{hint}</p>}
      </CardContent>
    </Card>
  );

  if (!href) return card;
  return (
    <Link href={href} className="block">
      {card}
    </Link>
  );
}
