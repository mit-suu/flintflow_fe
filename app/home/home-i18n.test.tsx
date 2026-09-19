import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import NotificationBell from "@/components/NotificationBell";
import Sidebar from "@/components/Sidebar";
import CheckoutPage from "./billing/checkout/page";
import BillingPage from "./billing/page";
import NotificationsPage from "./notifications/page";
import OnboardingPage from "./onboarding/page";
import HomePage from "./page";

/*
 * Khu vực đã đăng nhập song ngữ (T25 · P3). Mỗi màn render ở `en` với dữ liệu giả và khẳng định không còn
 * chữ tiếng Việt. Dữ liệu từ BE (tên gói, tiêu đề thông báo…) ở đây là tiếng Anh — BE trả gì thì hiện nấy.
 */

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: nav.refresh }),
  useSearchParams: () => nav.params,
}));

const api = vi.hoisted(() => ({
  apiCall: vi.fn(),
  getProgress: vi.fn(),
  fetchBalance: vi.fn(),
  fetchPackages: vi.fn(),
  fetchTransactions: vi.fn(),
  fetchCheckout: vi.fn(),
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiCall: api.apiCall }));
vi.mock("@/lib/api/pipeline", () => ({ getProgress: api.getProgress }));
vi.mock("@/lib/api/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/billing")>()),
  fetchBalance: api.fetchBalance,
  fetchPackages: api.fetchPackages,
  fetchTransactions: api.fetchTransactions,
  fetchCheckout: api.fetchCheckout,
  createCheckout: vi.fn(),
  upgradePlan: vi.fn(),
}));
vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: api.fetchNotifications,
  fetchUnreadCount: api.fetchUnreadCount,
  markAllNotificationsRead: vi.fn(() => Promise.resolve()),
  markNotificationRead: vi.fn(() => Promise.resolve()),
  onNotificationsChanged: () => () => {},
  emitNotificationsChanged: vi.fn(),
}));
vi.mock("@/lib/api/projects", () => ({ createProject: vi.fn() }));
vi.mock("@/lib/api/spine", () => ({ getSpine: vi.fn(), applyChanges: vi.fn() }));
vi.mock("./onboarding/api", () => ({ patchMe: vi.fn() }));

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const PROJECT = { _id: "p1", name: "Ride App", updatedAt: minutesAgo(120), domain: "mobility" };
const PROGRESS = {
  readiness: { accepted_pct: 50, awaiting_reaccept: 0, red_open: 0, stale: 0 },
  progress: { done: 10, total: 51, current_phase: "S-3", current_step: "S-3.1", show_percent: false },
  sections: [],
};
const BALANCE = {
  balance: 120,
  available: 100,
  reserved: 20,
  lowCreditThreshold: 500,
  plan: "free",
  planLabel: "Free",
  subscription: { currentPeriodEnd: "2026-10-01T00:00:00Z" },
};
const NOTIFICATION = {
  _id: "n1",
  title: "Step finished",
  body: "S-3.1 is ready for review",
  link: "/projects/p1",
  readAt: null,
  createdAt: minutesAgo(5),
};

beforeEach(() => {
  nav.params = new URLSearchParams();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.apiCall.mockImplementation((path: string) =>
    Promise.resolve(path.startsWith("/projects") ? { data: [PROJECT] } : { data: { onboardedAt: "2026-09-01" } })
  );
  api.getProgress.mockResolvedValue({ data: PROGRESS });
  api.fetchBalance.mockResolvedValue(BALANCE);
  api.fetchPackages.mockResolvedValue({
    packages: [{ id: "p100", label: "Starter", credits: 1000, amount: 99000 }],
    plans: [
      { id: "free", label: "Free", monthlyCredits: 100, priceVnd: 0 },
      { id: "pro", label: "Pro", monthlyCredits: 1000, priceVnd: 199000 },
    ],
  });
  api.fetchTransactions.mockResolvedValue({
    items: [
      { _id: "t1", type: "deduct", state: "deducted", amount: 5, actionType: "step_run", balanceAfter: 95, createdAt: minutesAgo(30) },
    ],
    meta: { page: 1, totalPages: 2 },
  });
  api.fetchNotifications.mockResolvedValue({ items: [NOTIFICATION], meta: { page: 1, totalPages: 2, unreadCount: 1 } });
  api.fetchUnreadCount.mockResolvedValue(1);
});

describe("Home (en)", () => {
  it("lưới dự án + menu thẻ + modal tạo / lưu trữ / xoá", async () => {
    const { container } = renderWithIntl(<HomePage />, "en");
    expect(await screen.findByText("Ride App")).toBeInTheDocument();
    await screen.findByText("Analyzing");
    expect(screen.getByText("2 hours ago · mobility")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);

    fireEvent.click(screen.getByText("⋮"));
    expect(vietnameseLeftovers(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Archive/ }));
    expect(screen.getByText("Archive “Ride App”?")).toBeInTheDocument();
    expect(vietnameseLeftovers(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByText("⋮"));
    fireEvent.click(screen.getByRole("button", { name: /Delete permanently/ }));
    expect(screen.getByText("cannot be undone").tagName).toBe("STRONG");
    expect(vietnameseLeftovers(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "+ New project" }));
    expect(screen.getByRole("heading", { name: "Create new project" })).toBeInTheDocument();
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });

  it("chưa có dự án ⇒ màn trống", async () => {
    api.apiCall.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith("/projects") ? { data: [] } : { data: { onboardedAt: "2026-09-01" } })
    );
    const { container } = renderWithIntl(<HomePage />, "en");
    expect(await screen.findByRole("heading", { name: "Start your first project" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("tìm không thấy ⇒ câu báo đã dịch", async () => {
    renderWithIntl(<HomePage />, "en");
    await screen.findByText("Ride App");
    fireEvent.change(screen.getByRole("textbox", { name: "Search projects by name" }), { target: { value: "zzz" } });
    expect(screen.getByText("No projects match “zzz”.")).toBeInTheDocument();
  });

  it("lỗi tải danh sách không kèm message ⇒ câu dự phòng theo ngôn ngữ", async () => {
    api.apiCall.mockImplementation(() => Promise.reject("boom"));
    renderWithIntl(<HomePage />, "en");
    expect(await screen.findByText("Could not load projects")).toBeInTheDocument();
  });
});

describe("Onboarding (en)", () => {
  it("cả ba bước, kể cả chọn cách làm việc", () => {
    const { container } = renderWithIntl(<OnboardingPage />, "en");
    expect(screen.getByRole("heading", { name: "Welcome to FlintFlow" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);

    fireEvent.change(screen.getByPlaceholderText("e.g. Alex"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
    expect(screen.getByRole("radio", { name: "Fast" })).toHaveAttribute("title", "Batch questions, review once at the end of each phase");
    expect(vietnameseLeftovers(container)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
    expect(screen.getByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});

describe("Thông báo (en)", () => {
  it("trang danh sách", async () => {
    const { container } = renderWithIntl(<NotificationsPage />, "en");
    expect(await screen.findByText("Step finished")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("chuông: mở xem trước", async () => {
    const { container } = renderWithIntl(<NotificationBell />, "en");
    const bell = await screen.findByRole("button", { name: "Notifications (1 unread)" });
    await act(async () => {
      fireEvent.click(bell);
    });
    expect(await screen.findByText("View all notifications")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});

describe("Thanh toán (en)", () => {
  it("số dư, gói, lịch sử giao dịch", async () => {
    const { container } = renderWithIntl(<BillingPage />, "en");
    expect(await screen.findByText("Transaction history")).toBeInTheDocument();
    expect(screen.getByText("Credit charge")).toBeInTheDocument();
    expect(screen.getByText("(charged)")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("Valid until 10/1/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy Pro plan" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("vi giữ định dạng số và ngày kiểu Việt", async () => {
    renderWithIntl(<BillingPage />, "vi");
    expect(await screen.findByText("Lịch sử giao dịch")).toBeInTheDocument();
    expect(screen.getByText("1.000")).toBeInTheDocument();
    expect(screen.getByText("Hiệu lực đến 1/10/2026")).toBeInTheDocument();
  });

  it("checkout đang chờ: mã QR, nội dung chuyển khoản", async () => {
    nav.params = new URLSearchParams({ intentId: "i1" });
    api.fetchCheckout.mockResolvedValue({
      status: "pending",
      amount: 99000,
      credits: 1000,
      qrCodeUrl: "https://qr.example/x.png",
      paymentDescription: "FF123",
    });
    const { container } = renderWithIntl(<CheckoutPage />, "en");
    expect(await screen.findByText("Waiting for payment confirmation…")).toBeInTheDocument();
    expect(screen.getByAltText("VietQR payment code")).toBeInTheDocument();
    expect(screen.getByText("Receive 1,000 credits")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("checkout thiếu intentId", () => {
    const { container } = renderWithIntl(<CheckoutPage />, "en");
    expect(screen.getByText("Missing transaction id (intentId).")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("checkout lỗi tải không kèm message ⇒ câu dự phòng theo ngôn ngữ", async () => {
    nav.params = new URLSearchParams({ intentId: "i1" });
    api.fetchCheckout.mockRejectedValue("boom");
    renderWithIntl(<CheckoutPage />, "en");
    expect(await screen.findByText("Could not load the transaction")).toBeInTheDocument();
  });
});

describe("Sidebar (en)", () => {
  it("điều hướng + menu người dùng có nút chuyển ngôn ngữ", async () => {
    const { container } = renderWithIntl(<Sidebar activePath="/home" user={{ name: "alex", plan: "Free Plan" }} />, "en");
    await waitFor(() => expect(api.fetchBalance).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /My projects/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText("alex"));
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
