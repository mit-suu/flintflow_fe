import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { InfiniteListState } from "@/lib/hooks/use-infinite-list";
import type { PagedListState } from "@/lib/hooks/use-paged-list";
import { InfiniteDataList, PagedDataList } from "./DataList";
import Pagination from "./Pagination";

const infinite = (over: Partial<InfiniteListState<string>> = {}): InfiniteListState<string> => ({
  items: ["a", "b"],
  total: 5,
  loading: false,
  loadingMore: false,
  error: null,
  loadMoreError: null,
  hasMore: true,
  retry: vi.fn(),
  reload: vi.fn(),
  sentinelRef: vi.fn(),
  ...over,
});

const paged = (over: Partial<PagedListState<string>> = {}): PagedListState<string> => ({
  items: ["a", "b"],
  total: 120,
  page: 1,
  totalPages: 6,
  pageSize: 20,
  loading: false,
  stale: false,
  error: null,
  setPage: vi.fn(),
  reload: vi.fn(),
  ...over,
});

const common = { getKey: (s: string) => s, renderItem: (s: string) => <span>row {s}</span>, loadingLabel: "Đang tải" };

describe("InfiniteDataList", () => {
  it("vẽ dòng + mốc cuối khi còn trang; báo số đã hiện cho trình đọc màn hình", () => {
    const list = infinite();
    renderWithIntl(<InfiniteDataList list={list} {...common} header={<p>cột</p>} />);
    expect(screen.getByText("row a")).toBeInTheDocument();
    expect(screen.getByText("cột")).toBeInTheDocument();
    expect(list.sentinelRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(screen.getByText("Đang hiện 2/5")).toBeInTheDocument();
  });

  it("lỗi trang sau ⇒ nút Thử lại gọi retry; rỗng ⇒ nội dung empty", () => {
    const list = infinite({ loadMoreError: new Error("x") });
    const { unmount } = renderWithIntl(<InfiniteDataList list={list} {...common} />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(list.retry).toHaveBeenCalled();
    unmount();
    renderWithIntl(<InfiniteDataList list={infinite({ items: [], hasMore: false })} {...common} empty={<p>trống</p>} />);
    expect(screen.getByText("trống")).toBeInTheDocument();
  });
});

describe("PagedDataList + Pagination", () => {
  it("bấm số trang / trang sau ⇒ setPage; trang hiện tại có aria-current", () => {
    const list = paged({ page: 2 });
    renderWithIntl(<PagedDataList list={list} {...common} />);
    expect(screen.getByText("21–40 / 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tới trang 2" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Tới trang 3" }));
    expect(list.setPage).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    expect(list.setPage).toHaveBeenCalledWith(1);
  });

  it("chỉ một trang ⇒ không có thanh chuyển trang; trang cuối ⇒ khoá nút Trang sau", () => {
    const { unmount } = renderWithIntl(<Pagination page={1} totalPages={1} total={3} pageSize={20} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<Pagination page={6} totalPages={6} total={120} pageSize={20} onPageChange={vi.fn()} />);
    expect(screen.getByText("101–120 / 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });
});
