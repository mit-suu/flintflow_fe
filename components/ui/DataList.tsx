"use client";

import { useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { InfiniteListState } from "@/lib/hooks/use-infinite-list";
import type { PagedListState } from "@/lib/hooks/use-paged-list";
import Button from "./Button";
import PageSkeleton from "./PageSkeleton";
import Pagination from "./Pagination";
import Skeleton from "./Skeleton";

/**
 * Danh sách dài dùng chung cho các trang người dùng, hai kiểu:
 *  - `InfiniteDataList` + `useInfiniteList`: cuộn gần cuối thì tự tải trang kế — danh sách để lướt / tìm rồi chọn
 *    (Thư viện mẫu, Thông báo).
 *  - `PagedDataList` + `usePagedList`: thanh `‹ 1 2 3 … ›` — bảng cần nhảy trang, đối chiếu (lịch sử giao dịch, Feedback).
 *
 * Cùng một khung: một mảng nền phẳng gom cả danh sách (không viền, không kẻ ngang), dòng nổi lên nền trắng khi rê chuột,
 * dòng tiêu đề cột tuỳ chọn, khung giữ chỗ lúc tải lần đầu, nội dung rỗng do trang truyền vào. Lỗi tải lần đầu do trang tự
 * hiện (thường là thanh báo lỗi phía trên) — khung không đoán thay.
 * Mẫu dùng: `app/home/library/page.tsx`.
 */
interface DataListProps<T> {
  getKey: (item: T) => string;
  /** Nội dung của một dòng (bên trong `<li>`). */
  renderItem: (item: T) => ReactNode;
  /** Class thêm vào `<li>` — vd lưới cột `md:grid md:grid-cols-[…]` để thẳng với `header`. */
  rowClassName?: string;
  /** Dòng tiêu đề cột, nằm trong mảng nền phía trên các dòng (nên `aria-hidden` nếu chỉ để nhìn). */
  header?: ReactNode;
  /** Hiện khi đã tải xong mà không có mục nào (vd "Không có mẫu nào khớp…"). */
  empty?: ReactNode;
  /** Nhãn trình đọc màn hình cho khung giữ chỗ. */
  loadingLabel?: string;
  /** Số dòng giữ chỗ lúc tải lần đầu. */
  skeletonRows?: number;
}

/** Class nền của một dòng — trang chỉ thêm phần riêng (lưới cột, `relative`…) qua `rowClassName`. */
const ROW = "rounded-control px-3 py-3 transition-colors hover:bg-surface-container-lowest";

/** Dòng giữ chỗ cùng nhịp với dòng thật (icon vuông + hai dòng chữ). */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Skeleton className="size-9 shrink-0 rounded-control" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

function Rows<T>({ items, getKey, renderItem, rowClassName, header }: Pick<DataListProps<T>, "getKey" | "renderItem" | "rowClassName" | "header"> & { items: T[] }) {
  return (
    <>
      {header}
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={getKey(item)} className={`${ROW} ${rowClassName ?? ""}`}>
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Danh sách tải dần khi cuộn. `list` là kết quả `useInfiniteList` (gắn `root` = vùng cuộn của trang). */
export function InfiniteDataList<T>({
  list: { items, total, loading, loadingMore, loadMoreError, hasMore, retry, sentinelRef },
  empty,
  loadingLabel,
  skeletonRows = 6,
  ...rows
}: DataListProps<T> & { list: InfiniteListState<T> }) {
  const t = useTranslations("common.dataTable");
  if (loading) return <PageSkeleton variant="list" rows={skeletonRows} bare label={loadingLabel} />;
  if (items.length === 0) return <>{empty ?? null}</>;
  return (
    <div className="rounded-card bg-surface-container-low p-1.5">
      <Rows items={items} {...rows} />
      {/* Cuối danh sách: dòng giữ chỗ lúc đang tải trang kế, lỗi kèm nút thử lại, mốc kích tải trang kế */}
      {loadingMore && (
        <div role="status" aria-label={loadingLabel}>
          <ListRowSkeleton />
          <ListRowSkeleton />
        </div>
      )}
      {loadMoreError ? (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-3 px-3 py-3 text-body text-on-surface-muted">
          {t("loadMoreFailed")}
          <Button size="sm" variant="secondary" onClick={retry}>
            {t("retry")}
          </Button>
        </div>
      ) : null}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
      <p className="sr-only" aria-live="polite">
        {t("shown", { shown: items.length, total })}
      </p>
    </div>
  );
}

/** Danh sách phân trang theo số trang. `list` là kết quả `usePagedList`. Đổi trang thì cuộn về đầu danh sách. */
export function PagedDataList<T>({
  list: { items, total, page, totalPages, pageSize, loading, stale, setPage },
  empty,
  loadingLabel,
  skeletonRows = 6,
  ...rows
}: DataListProps<T> & { list: PagedListState<T> }) {
  const top = useRef<HTMLDivElement>(null);
  if (loading) return <PageSkeleton variant="list" rows={skeletonRows} bare label={loadingLabel} />;
  if (items.length === 0 && !stale) return <>{empty ?? null}</>;

  const goTo = (next: number) => {
    setPage(next);
    top.current?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div ref={top} className="flex flex-col gap-3 scroll-mt-20">
      {/* Đang tải trang khác: giữ trang cũ, làm mờ — không nháy về khung giữ chỗ */}
      <div aria-busy={stale} className={`rounded-card bg-surface-container-low p-1.5 transition-opacity ${stale ? "opacity-60" : ""}`}>
        <Rows items={items} {...rows} />
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={goTo} disabled={stale} className="px-1" />
    </div>
  );
}
