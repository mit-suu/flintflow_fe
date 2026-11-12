"use client";

import { useTranslations } from "next-intl";
import { getPageNumbers } from "@/lib/utils";
import IconButton from "./IconButton";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Tổng số mục — để hiện "21–40 / 120". */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Đang tải trang mới — khoá nút để không bấm dồn. */
  disabled?: boolean;
  className?: string;
}

/**
 * Thanh chuyển trang `‹ 1 2 3 … 6 ›` kèm "21–40 / 120", phẳng theo giao diện app (bảng Admin dùng `DataTablePagination` của
 * shadcn, gắn với tanstack-table). Chỉ có một trang thì không hiện gì. Trang đang xem đánh `aria-current="page"`.
 */
export default function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled = false, className }: PaginationProps) {
  const t = useTranslations("common.dataTable");
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label={t("pagination")} className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-body text-on-surface-muted tabular-nums">{t("range", { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <IconButton icon="caret-left" size="md" label={t("previousPage")} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} />
        {getPageNumbers(page, totalPages).map((p, i) =>
          typeof p === "number" ? (
            <button
              key={p}
              type="button"
              aria-label={t("goToPage", { page: p })}
              aria-current={p === page ? "page" : undefined}
              disabled={disabled}
              onClick={() => p !== page && onPageChange(p)}
              className={`min-w-9 h-9 px-2 rounded-control text-body tabular-nums transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                p === page ? "bg-primary-soft text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={`gap-${i}`} aria-hidden className="min-w-6 text-center text-on-surface-muted">
              …
            </span>
          )
        )}
        <IconButton icon="caret-right" size="md" label={t("nextPage")} disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)} />
      </div>
    </nav>
  );
}
