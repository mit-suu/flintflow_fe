import { screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { Locale } from "@/lib/i18n";
import BillingPage from "./billing/page";
import CheckoutPage from "./billing/checkout/page";
import NotificationsPage from "./notifications/page";
import ProfilePage from "./profile/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams({ intentId: "pi_1" }),
}));
vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: vi.fn(async () => ({
    items: [
      {
        _id: "n1",
        type: "low_credit",
        title: "Credit sắp hết",
        body: "Số dư của bạn còn 8 credit.",
        readAt: null,
        meta: { balance: 8 },
        createdAt: new Date().toISOString(),
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1, unreadCount: 1 },
  })),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  onNotificationsChanged: () => () => {},
  emitNotificationsChanged: vi.fn(),
  fetchUnreadCount: vi.fn(async () => 1),
}));
vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/billing")>();
  return {
    ...actual,
    fetchBalance: vi.fn(async () => ({
      balance: 1200,
      available: 1200,
      reserved: 0,
      plan: "free",
      planLabel: "Free",
      lowCreditThreshold: 50,
      subscription: null,
    })),
    fetchPackages: vi.fn(async () => ({
      packages: [{ id: "p100", label: "100 credit", credits: 100, amount: 49000 }],
      plans: [{ id: "free", label: "Free", monthlyCredits: 100, priceVnd: 0 }],
    })),
    fetchTransactions: vi.fn(async () => ({
      items: [
        { _id: "t1", type: "purchase", state: null, actionType: "topup", amount: 100, balanceAfter: 1200, createdAt: new Date().toISOString() },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })),
    fetchCheckout: vi.fn(async () => ({
      intentId: "pi_1",
      status: "pending",
      amount: 49000,
      credits: 100,
      qrCodeUrl: null,
      paymentDescription: "FF PI1",
    })),
    createCheckout: vi.fn(),
    upgradePlan: vi.fn(),
  };
});
vi.mock("@/lib/api/users", () => ({
  fetchMe: vi.fn(async () => ({
    id: "u1",
    email: "mai@studio.vn",
    name: "Mai",
    balance: 1200,
    authProvider: "local",
    emailVerified: true,
    hasPassword: true,
    createdAt: "2026-01-05T00:00:00Z",
  })),
  updateMyName: vi.fn(),
  updateMyLocale: vi.fn(),
  changeMyPassword: vi.fn(),
}));

const renderInShell = (page: ReactElement, locale: Locale) =>
  renderWithIntl(<AppShell sidebar={null}>{page}</AppShell>, locale);

const PAGES: readonly [string, ReactElement, string][] = [
  ["thông báo", <NotificationsPage key="n" />, "Notifications"],
  ["thanh toán", <BillingPage key="b" />, "Billing & credits"],
  ["hồ sơ", <ProfilePage key="p" />, "Your profile"],
];

describe("Trang tài khoản — song ngữ", () => {
  it.each(PAGES)("bản en của trang %s dịch tiêu đề và không còn chữ tiếng Việt", async (_name, page, heading) => {
    const { container } = renderInShell(page, "en");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading));
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("checkout bản en không còn chữ tiếng Việt", async () => {
    const { container } = renderInShell(<CheckoutPage />, "en");
    await waitFor(() => expect(screen.getByText("Amount to transfer")).toBeInTheDocument());
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("thông báo dựng lại câu theo ngôn ngữ, không dùng chữ BE đã lưu", async () => {
    renderInShell(<NotificationsPage />, "en");
    await waitFor(() => expect(screen.getByText("Credits running low")).toBeInTheDocument());
    expect(screen.getByText(/8 credits/)).toBeInTheDocument();
  });
});
