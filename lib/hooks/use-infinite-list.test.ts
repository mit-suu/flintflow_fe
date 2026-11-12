import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInfiniteList, type ListPage } from "./use-infinite-list";

/** IntersectionObserver giả: giữ callback để test tự "cuộn tới mốc". */
let fire: (() => void) | null = null;
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    fire = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  disconnect() {
    fire = null;
  }
}

const page = (n: number, totalPages: number, prefix = "x"): ListPage<string> => ({
  items: [`${prefix}${n}a`, `${prefix}${n}b`],
  meta: { page: n, limit: 2, total: totalPages * 2, totalPages },
});

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fire = null;
});

describe("useInfiniteList", () => {
  it("tải trang 1, mốc lọt vùng nhìn ⇒ nối trang 2; hết trang thì thôi quan sát", async () => {
    const fetchPage = vi.fn(async (n: number) => page(n, 2));
    const { result } = renderHook(() => useInfiniteList({ fetchPage, key: "k" }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.items).toEqual(["x1a", "x1b"]));
    expect(result.current.total).toBe(4);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.sentinelRef(document.createElement("div")));
    await waitFor(() => expect(fire).not.toBeNull());
    act(() => fire!());
    await waitFor(() => expect(result.current.items).toEqual(["x1a", "x1b", "x2a", "x2b"]));
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("đổi key ⇒ tải lại từ trang 1, phản hồi muộn của key cũ bị bỏ", async () => {
    let resolveOld: (v: ListPage<string>) => void = () => undefined;
    const fetchPage = vi.fn((n: number) => new Promise<ListPage<string>>((r) => (resolveOld = r)).then((v) => v ?? page(n, 1)));
    const { result, rerender } = renderHook(({ k }) => useInfiniteList({ fetchPage: k === "old" ? fetchPage : async () => page(1, 1, "new"), key: k }), {
      initialProps: { k: "old" },
    });
    rerender({ k: "new" });
    await waitFor(() => expect(result.current.items).toEqual(["new1a", "new1b"]));
    await act(async () => resolveOld(page(1, 1, "old")));
    expect(result.current.items).toEqual(["new1a", "new1b"]);
  });

  it("lỗi trang sau ⇒ loadMoreError, retry tải lại đúng trang đó", async () => {
    const fetchPage = vi
      .fn<(n: number) => Promise<ListPage<string>>>()
      .mockResolvedValueOnce(page(1, 2))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(page(2, 2));
    const { result } = renderHook(() => useInfiniteList({ fetchPage, key: "k" }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.sentinelRef(document.createElement("div")));
    await waitFor(() => expect(fire).not.toBeNull());
    act(() => fire!());
    await waitFor(() => expect(result.current.loadMoreError).toBeInstanceOf(Error));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(fetchPage).toHaveBeenLastCalledWith(2);
    expect(result.current.loadMoreError).toBeNull();
  });

  it("reload ⇒ tải lại trang 1 với cùng key", async () => {
    const fetchPage = vi.fn(async (n: number) => page(n, 1));
    const { result } = renderHook(() => useInfiniteList({ fetchPage, key: "k" }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.reload());
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith(1);
  });
});
