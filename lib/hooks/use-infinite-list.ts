"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Một trang dữ liệu từ BE: `meta` theo dạng chung `{ page, limit, total, totalPages }` của các endpoint phân trang. */
export interface ListPage<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface UseInfiniteListOptions<T> {
  /** Lấy trang `page` (từ 1). Đọc giá trị mới nhất mỗi lần gọi nên không cần bọc `useCallback`. */
  fetchPage: (page: number) => Promise<ListPage<T>>;
  /** Đổi `key` (từ khoá tìm, sắp xếp, bộ lọc…) ⇒ bỏ danh sách đang có, tải lại từ trang 1. */
  key: string;
  /** `false` ⇒ chưa tải (vd chưa biết tổ chức đang mở). */
  enabled?: boolean;
  /** Phần tử vùng cuộn chứa danh sách (lấy bằng callback ref + state); bỏ trống = khung nhìn. Để `rootMargin` tính theo đúng vùng cuộn. */
  root?: HTMLElement | null;
  /** Tải trang tiếp khi mốc cuối danh sách còn cách mép dưới vùng cuộn khoảng này. */
  rootMargin?: string;
}

interface ListState<T> {
  /** `key` của lần tải trang 1 gần nhất đã về — khác `key` hiện tại nghĩa là đang tải lại từ đầu. */
  key: string | null;
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  error: unknown;
}

const EMPTY = { items: [], page: 0, totalPages: 1, total: 0, error: null };

/**
 * Danh sách tải dần khi cuộn (infinite scroll) cho các endpoint có `page` / `limit` / `meta.totalPages`.
 *
 * Gắn `sentinelRef` vào một phần tử rỗng ngay sau danh sách: mốc lọt vào vùng nhìn (cộng `rootMargin`) thì tải trang kế.
 * Sau mỗi trang, mốc được quan sát lại — trang đầu ngắn hơn màn hình thì tự tải tiếp tới khi đầy hoặc hết.
 * Phản hồi của `key` cũ (gõ tìm nhanh, đổi sắp xếp giữa chừng) bị bỏ, không chèn nhầm vào danh sách mới.
 * Lỗi trang đầu ở `error`; lỗi trang sau ở `loadMoreError` — trang hiện `retry` thay vì lặng lẽ dừng.
 */
export function useInfiniteList<T>({ fetchPage, key, enabled = true, root = null, rootMargin = "300px" }: UseInfiniteListOptions<T>) {
  const [nonce, setNonce] = useState(0);
  const fullKey = `${key}#${nonce}`;
  const [state, setState] = useState<ListState<T>>({ key: null, ...EMPTY });
  /** `key` đang tải trang sau — gắn theo key để phản hồi muộn của key cũ không kẹt cờ của key mới. */
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<{ key: string; error: unknown } | null>(null);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  const fetchRef = useRef(fetchPage);
  const stateRef = useRef(state);
  const keyRef = useRef(fullKey);
  /** Tăng mỗi lần tải lại từ đầu — phản hồi mang số cũ thì bỏ. */
  const generation = useRef(0);
  /** Thế hệ đang có một lượt tải trang sau chạy dở (chặn gọi trùng); `-1` = rảnh. */
  const busy = useRef(-1);
  useEffect(() => {
    fetchRef.current = fetchPage;
    stateRef.current = state;
    keyRef.current = fullKey;
  });

  // Trang 1 mỗi khi `key` đổi. Không đặt state đồng bộ ở đây: "đang tải" suy ra từ `state.key !== fullKey`.
  useEffect(() => {
    if (!enabled) return;
    const id = ++generation.current;
    fetchRef
      .current(1)
      .then((res) => {
        if (id !== generation.current) return;
        setState({ key: fullKey, items: res.items, page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total, error: null });
      })
      .catch((error: unknown) => {
        if (id === generation.current) setState({ key: fullKey, ...EMPTY, error });
      });
  }, [enabled, fullKey]);

  const current = state.key === fullKey;
  const hasMore = current && !state.error && state.page < state.totalPages;
  const loadMoreError = moreError?.key === fullKey ? moreError.error : null;
  const loadingMore = loadingMoreKey === fullKey;

  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (busy.current === generation.current || s.key !== keyRef.current || s.error || s.page >= s.totalPages) return;
    const id = generation.current;
    busy.current = id;
    const requestKey = keyRef.current;
    setLoadingMoreKey(requestKey);
    setMoreError(null);
    fetchRef
      .current(s.page + 1)
      .then((res) => {
        if (id !== generation.current) return;
        setState((prev) => ({ ...prev, items: [...prev.items, ...res.items], page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total }));
      })
      .catch((error: unknown) => {
        if (id === generation.current) setMoreError({ key: requestKey, error });
      })
      .finally(() => {
        if (busy.current === id) busy.current = -1;
        setLoadingMoreKey((k) => (k === requestKey ? null : k));
      });
  }, []);

  // Quan sát lại sau mỗi trang (phụ thuộc số dòng + `loadingMore`): mốc vẫn trong vùng nhìn thì tải tiếp ngay
  useEffect(() => {
    if (!sentinel || !hasMore || loadingMore || loadMoreError || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      root,
      rootMargin: `0px 0px ${rootMargin} 0px`,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasMore, loadingMore, loadMoreError, loadMore, root, rootMargin, state.items.length]);

  /** Tải lại từ đầu với cùng `key` — sau khi thêm / xoá một mục. */
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items: current ? state.items : [],
    /** Tổng số mục khớp `key` hiện tại (theo BE), không phải số đã tải. */
    total: current ? state.total : 0,
    /** Đang tải trang đầu của `key` hiện tại. */
    loading: enabled && !current,
    loadingMore,
    error: current ? state.error : null,
    loadMoreError,
    hasMore,
    /** Thử lại trang sau vừa lỗi. */
    retry: loadMore,
    reload,
    /** Callback ref cho phần tử mốc cuối danh sách. */
    sentinelRef: setSentinel,
  };
}

/** Kết quả của `useInfiniteList` — đưa thẳng vào `InfiniteDataList`. */
export type InfiniteListState<T> = ReturnType<typeof useInfiniteList<T>>;
