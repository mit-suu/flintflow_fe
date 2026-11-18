"use client";

import { useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";

interface UseServerDataTableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** Tổng số trang do BE trả (`meta.totalPages`). */
  pageCount: number;
  pageSize: number;
}

/**
 * Bảng mà **BE lo lọc và phân trang**: TanStack chỉ giữ state của thanh công cụ, không tự cắt trang hay
 * tự lọc trên mảng đang có (`manualPagination` + `manualFiltering`) — nếu để nó tự làm thì nó chỉ thấy
 * một trang dữ liệu và ra số sai.
 *
 * Đổi ô tìm hoặc bộ lọc thì nhảy về trang 1: ở chế độ manual, TanStack không tự reset trang, giữ nguyên
 * trang 5 cho một bộ lọc chỉ còn 2 trang sẽ ra bảng rỗng.
 */
export function useServerDataTable<TData>({ data, columns, pageCount, pageSize }: UseServerDataTableOptions<TData>) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const toFirstPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }));

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination, globalFilter, columnFilters, columnVisibility },
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    onPaginationChange: setPagination,
    onGlobalFilterChange: (next) => {
      setGlobalFilter(next as string);
      toFirstPage();
    },
    onColumnFiltersChange: (next) => {
      setColumnFilters(next);
      toFirstPage();
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  return { table, pagination, globalFilter, columnFilters };
}

/**
 * Giá trị của một bộ lọc một-lựa-chọn. Thanh lọc của shadcn cho chọn nhiều giá trị, nhưng endpoint admin
 * chỉ nhận một (`role`, `plan`, `isActive`) — chọn từ hai giá trị trở lên nghĩa là không lọc gì.
 */
export function singleFilterValue(filters: ColumnFiltersState, columnId: string): string | undefined {
  const value = filters.find((f) => f.id === columnId)?.value;
  return Array.isArray(value) && value.length === 1 ? String(value[0]) : undefined;
}
