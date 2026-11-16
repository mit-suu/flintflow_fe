import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/notifications";
import type { AppNotification } from "@/lib/api/notifications";
import NotificationsPage from "./page";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
// Giữ nguyên emit / on thật để thử luồng "đã đổi"; chỉ giả lời gọi BE
vi.mock("@/lib/api/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/notifications")>();
  return {
    ...actual,
    fetchNotifications: vi.fn(),
    fetchUnreadCount: vi.fn(async () => 0),
    markNotificationRead: vi.fn(async () => {
      actual.emitNotificationsChanged();
      return undefined;
    }),
    markAllNotificationsRead: vi.fn(async () => {
      actual.emitNotificationsChanged();
      return 0;
    }),
  };
});

/** IntersectionObserver giả: giữ callback để test tự "cuộn tới mốc cuối". */
let reachEnd: (() => void) | null = null;
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    reachEnd = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  disconnect() {
    reachEnd = null;
  }
}

const note = (id: string, readAt: string | null = null): AppNotification => ({
  _id: id,
  type: "custom",
  title: `Tiêu đề ${id}`,
  body: `Nội dung ${id}`,
  readAt,
  createdAt: "2026-11-01T03:00:00.000Z",
});
const page = (n: number, totalPages: number, unreadCount = 2) => ({
  items: [note(`n${n}a`), note(`n${n}b`)],
  meta: { page: n, limit: 20, total: totalPages * 2, totalPages, unreadCount },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.mocked(api.fetchNotifications).mockImplementation(async ({ page: n = 1 } = {}) => page(n, 2));
});
afterEach(() => {
  vi.unstubAllGlobals();
  reachEnd = null;
});

describe("Trang Thông báo (FLF-404: cuộn tải dần)", () => {
  it("cuộn tới cuối ⇒ tự nối trang 2, không còn nút Tải thêm", async () => {
    renderWithIntl(<NotificationsPage />);
    expect(await screen.findByText("Tiêu đề n1a")).toBeInTheDocument();
    expect(screen.getByText("2 chưa đọc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument();

    await waitFor(() => expect(reachEnd).not.toBeNull());
    act(() => reachEnd!());
    expect(await screen.findByText("Tiêu đề n2b")).toBeInTheDocument();
    expect(api.fetchNotifications).toHaveBeenLastCalledWith({ unread: false, page: 2, limit: 20 });
  });

  it("đánh dấu một mục ⇒ sửa tại chỗ, giữ trang đã nối, không tải lại; số chưa đọc lấy lại từ BE", async () => {
    renderWithIntl(<NotificationsPage />);
    await screen.findByText("Tiêu đề n1a");
    await waitFor(() => expect(reachEnd).not.toBeNull());
    act(() => reachEnd!());
    await screen.findByText("Tiêu đề n2b");
    const calls = vi.mocked(api.fetchNotifications).mock.calls.length;
    vi.mocked(api.fetchUnreadCount).mockResolvedValueOnce(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Đánh dấu đã đọc" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Đánh dấu đã đọc" })).toHaveLength(3));
    expect(api.markNotificationRead).toHaveBeenCalledWith("n1a");
    expect(screen.getByText("Tiêu đề n2b")).toBeInTheDocument();
    expect(api.fetchNotifications).toHaveBeenCalledTimes(calls);
    expect(await screen.findByText("1 chưa đọc")).toBeInTheDocument();
  });

  it("đổi ở nơi khác (đánh dấu tất cả) ⇒ tải lại từ trang 1", async () => {
    renderWithIntl(<NotificationsPage />);
    await screen.findByText("Tiêu đề n1a");
    vi.mocked(api.fetchNotifications).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledWith({ unread: false, page: 1, limit: 20 }));
  });

  it("tab Chưa đọc ⇒ gọi BE với unread; rỗng ⇒ báo đã đọc hết", async () => {
    renderWithIntl(<NotificationsPage />);
    await screen.findByText("Tiêu đề n1a");
    vi.mocked(api.fetchNotifications).mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, unreadCount: 0 } });
    fireEvent.click(screen.getByRole("tab", { name: "Chưa đọc" }));
    expect(await screen.findByText("Bạn đã đọc hết thông báo")).toBeInTheDocument();
    expect(api.fetchNotifications).toHaveBeenLastCalledWith({ unread: true, page: 1, limit: 20 });
  });
});
