import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ListPage } from "./use-infinite-list";
import { usePagedList } from "./use-paged-list";

const page = (n: number, prefix = "x"): ListPage<string> => ({
  items: [`${prefix}${n}a`, `${prefix}${n}b`],
  meta: { page: n, limit: 2, total: 6, totalPages: 3 },
});

describe("usePagedList", () => {
  it("tải trang 1; setPage ⇒ giữ trang cũ (stale) tới khi trang mới về", async () => {
    let release: () => void = () => undefined;
    const fetchPage = vi.fn((n: number) => (n === 1 ? Promise.resolve(page(1)) : new Promise<ListPage<string>>((r) => (release = () => r(page(n))))));
    const { result } = renderHook(() => usePagedList({ fetchPage, key: "k" }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.items).toEqual(["x1a", "x1b"]));
    expect(result.current).toMatchObject({ page: 1, totalPages: 3, total: 6, pageSize: 2, stale: false });

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.stale).toBe(true);
    expect(result.current.items).toEqual(["x1a", "x1b"]);
    await act(async () => release());
    expect(result.current.items).toEqual(["x2a", "x2b"]);
    expect(result.current.stale).toBe(false);
  });

  it("đổi key ⇒ về trang 1", async () => {
    const fetchPage = vi.fn(async (n: number) => page(n));
    const { result, rerender } = renderHook(({ k }) => usePagedList({ fetchPage, key: k }), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.items).toEqual(["x3a", "x3b"]));
    rerender({ k: "b" });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(1));
  });

  it("lỗi ⇒ error, reload thử lại cùng trang", async () => {
    const fetchPage = vi.fn<(n: number) => Promise<ListPage<string>>>().mockRejectedValueOnce(new Error("down")).mockResolvedValue(page(1));
    const { result } = renderHook(() => usePagedList({ fetchPage, key: "k" }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.error).toBeNull();
  });
});
