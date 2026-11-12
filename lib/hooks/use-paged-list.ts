"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListPage } from "./use-infinite-list";

interface UsePagedListOptions<T> {
  /** Lấy trang `page` (từ 1). Đọc giá trị mới nhất mỗi lần gọi nên không cần bọc `useCallback`. */
  fetchPage: (page: number) => Promise<ListPage<T>>;
  /** Đổi `key` (từ khoá tìm, sắp xếp, bộ lọc…) ⇒ về trang 1. */
  key: string;
  /** `false` ⇒ chưa tải (vd chưa biết tổ chức đang mở). */
  enabled?: boolean;
}

interface Loaded<T> {
  /** `${key}#${nonce}@${page}` của lần tải đã về. */
  at: string;
  items: T[];
  total: number;
  totalPages: number;
  limit: number;
  error: unknown;
}

/**
 * Danh sách phân trang theo số trang (`‹ 1 2 3 … ›`) trên endpoint có `page` / `limit` / `meta.totalPages` — dùng cho bảng cần
 * nhảy trang, đối chiếu (lịch sử giao dịch, bảng quản trị). Danh sách để lướt thì dùng `useInfiniteList`.
 *
 * Đang tải trang khác thì vẫn giữ trang cũ trên màn (`stale = true`, trang làm mờ đi) thay vì nháy về khung giữ chỗ.
 * Phản hồi của trang / `key` cũ về muộn bị bỏ. Kết quả đưa thẳng vào `PagedDataList`.
 */
export function usePagedList<T>({ fetchPage, key, enabled = true }: UsePagedListOptions<T>) {
  const [nonce, setNonce] = useState(0);
  const fullKey = `${key}#${nonce}`;
  // Trang gắn với key: đổi key thì tự về 1 mà không cần đặt state trong effect
  const [cursor, setCursor] = useState({ key: fullKey, page: 1 });
  const page = cursor.key === fullKey ? cursor.page : 1;
  const at = `${fullKey}@${page}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchRef
      .current(page)
      .then((res) => {
        if (!cancelled) setLoaded({ at, items: res.items, total: res.meta.total, totalPages: res.meta.totalPages, limit: res.meta.limit, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ at, items: prev?.items ?? [], total: prev?.total ?? 0, totalPages: prev?.totalPages ?? 1, limit: prev?.limit ?? 0, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, at, page]);

  const setPage = useCallback((next: number) => setCursor({ key: fullKey, page: next }), [fullKey]);
  /** Tải lại trang đang xem — sau khi thêm / xoá một mục. */
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const fresh = loaded?.at === at;
  return {
    items: loaded?.items ?? [],
    /** Tổng số mục khớp `key` (theo BE). */
    total: loaded?.total ?? 0,
    page,
    totalPages: loaded?.totalPages ?? 1,
    pageSize: loaded?.limit ?? 0,
    /** Chưa có dữ liệu nào để hiện (lần đầu). */
    loading: enabled && loaded === null,
    /** Đang tải trang / key khác, đang hiện dữ liệu cũ. */
    stale: enabled && loaded !== null && !fresh,
    error: fresh ? loaded?.error : null,
    setPage,
    reload,
  };
}

/** Kết quả của `usePagedList` — đưa thẳng vào `PagedDataList`. */
export type PagedListState<T> = ReturnType<typeof usePagedList<T>>;
