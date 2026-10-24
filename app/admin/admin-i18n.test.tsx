import { fireEvent, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import {
  fetchAdminFeedback,
  fetchAdminMetrics,
  fetchAdminOrgs,
  fetchAdminUser,
  fetchAdminUsers,
  fetchAiCost,
  type AdminOrg,
  type AdminUserDetail,
  type AiCostReport,
} from "@/lib/api/admin";
import type { Locale } from "@/lib/i18n";
import { MESSAGES, renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { AdminSearchProvider } from "./_components/AdminSearch";
import AdminSidebar from "./_components/AdminSidebar";
import AdminAiCostPage from "./ai-cost/page";
import AdminFeedbackPage from "./feedback/page";
import AdminMetricsPage from "./metrics/page";
import AdminOrgsPage from "./orgs/page";
import AdminUserDetailPage from "./users/[id]/page";
import AdminUsersPage from "./users/page";

/*
 * Admin song ngữ (FLF-328): ở `en` không còn chữ tiếng Việt nào của UI. Dữ liệu mẫu đặt tên/email không dấu để
 * phép thử "còn tiếng Việt không" chỉ đo chữ giao diện (tên tổ chức, lý do khoá… là dữ liệu, không dịch).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/metrics",
  useParams: () => ({ id: "u1" }),
}));
vi.mock("@/lib/api/users", () => ({
  fetchMe: vi.fn(async () => ({ name: "Mai", email: "mai@studio.vn" })),
  updateMyLocale: vi.fn(async () => undefined),
}));
vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  fetchAdminMetrics: vi.fn(),
  fetchAiCost: vi.fn(),
  fetchAdminUsers: vi.fn(),
  fetchAdminUser: vi.fn(),
  fetchAdminOrgs: vi.fn(),
  fetchAdminFeedback: vi.fn(),
}));

const ORG: AdminOrg = {
  id: "o1",
  name: "Alpha Studio",
  owner: null,
  plan: "free",
  planLabel: "Free",
  wallet: { balance: 1500, reserved: 20, available: 1480 },
  membersCount: 3,
  projectsCount: 2,
  createdAt: "2026-09-01T00:00:00.000Z",
};

const USER: AdminUserDetail = {
  _id: "u1",
  email: "member@flintflow.vn",
  name: null,
  role: "admin",
  isActive: false,
  suspendedAt: "2026-09-29T03:00:00.000Z",
  suspendReason: "Spam",
  emailVerified: false,
  authProvider: "local",
  createdAt: "2026-09-01T00:00:00.000Z",
  organizationsCount: 1,
  projectsCount: 2,
  lastLoginAt: null,
  organizations: [
    { id: "o1", name: "Org Alpha", role: "lead", joinedAt: "2026-09-02T00:00:00.000Z", wallet: null },
  ],
  recentTransactions: [
    {
      _id: "t1",
      type: "deduct",
      state: "deducted",
      actionType: "draft_section",
      amount: -5,
      balanceAfter: 95,
      createdAt: "2026-09-03T00:00:00.000Z",
    } as AdminUserDetail["recentTransactions"][number],
  ],
};

const COST: AiCostReport = {
  from: "2026-09-01",
  to: "2026-09-07",
  groupBy: "day",
  currency: "USD",
  pricingNote: "Estimated from list prices",
  rows: [],
  totals: { calls: 0, failedCalls: 0, promptTokens: 0, completionTokens: 0, credits: 0, estimatedUsd: 0 },
};

const META = { page: 1, limit: 20, total: 1, totalPages: 1 };

beforeAll(() => {
  // `useIsMobile` của sidebar shadcn đọc `matchMedia` — jsdom không có.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  vi.mocked(fetchAdminMetrics).mockResolvedValue({
    usersTotal: 12,
    usersNew7d: 3,
    projectsTotal: 40,
    projectsActive7d: 9,
    baselinesTotal: 5,
    aiCallsToday: 7,
    aiCalls7d: 120,
    aiFailRate7d: 0.05,
  });
  vi.mocked(fetchAiCost).mockResolvedValue(COST);
  vi.mocked(fetchAdminUsers).mockResolvedValue({ items: [USER], meta: META });
  vi.mocked(fetchAdminUser).mockResolvedValue(USER);
  vi.mocked(fetchAdminOrgs).mockResolvedValue({ items: [ORG], meta: META });
  vi.mocked(fetchAdminFeedback).mockResolvedValue([
    { _id: "f1", category: "bug", message: "Save button broken", createdAt: "2026-09-19T03:00:00Z", user: null },
  ]);
});

const inShell = (page: React.ReactNode) => (
  <AdminSearchProvider>
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>{page}</SidebarInset>
    </SidebarProvider>
  </AdminSearchProvider>
);

describe("Admin — song ngữ", () => {
  it("vi giữ nguyên chữ cũ của khung admin và trang số liệu", async () => {
    renderWithIntl(inShell(<AdminMetricsPage />), "vi");
    expect(await screen.findByText("Số liệu hệ thống")).toBeInTheDocument();
    expect(screen.getByText("+3 trong 7 ngày")).toBeInTheDocument();
    expect(screen.getByText("Lỗi 7 ngày: 5.0% / 120 lượt")).toBeInTheDocument();
    expect(screen.getByText("Vận hành")).toBeInTheDocument();
    expect(screen.getByText("Tìm trang")).toBeInTheDocument();
  });

  it("en: khung admin (sidebar, thanh đầu, bảng lệnh ⌘K) + trang số liệu không còn tiếng Việt", async () => {
    const { container } = renderWithIntl(inShell(<AdminMetricsPage />), "en");
    expect(await screen.findByText("System metrics")).toBeInTheDocument();
    expect(screen.getByText("7-day failure rate: 5.0% of 120 calls")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "AI cost" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Find page/ }));
    expect(await screen.findByPlaceholderText("Type the page you want…")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });

  it.each([
    ["người dùng", () => <AdminUsersPage />, "1 account in the system."],
    ["chi tiết người dùng", () => <AdminUserDetailPage />, "Account status"],
    ["tổ chức", () => <AdminOrgsPage />, "1 organization, with its credit wallet."],
    ["chi phí AI", () => <AdminAiCostPage />, "No data in this date range"],
    ["phản hồi", () => <AdminFeedbackPage />, "Bug report"],
  ])("en: trang %s không còn tiếng Việt", async (_name, page, marker) => {
    const { container } = renderWithIntl(inShell(page()), "en");
    expect((await screen.findAllByText(marker)).length).toBeGreaterThan(0);
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("en: hộp thoại điều chỉnh credit không còn tiếng Việt", async () => {
    renderWithIntl(inShell(<AdminOrgsPage />), "en");
    fireEvent.click(await screen.findByRole("button", { name: "Adjust credits for Alpha Studio" }));
    expect(await screen.findByText("Reason (required)")).toBeInTheDocument();
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });

  it("chú thích biểu đồ: vi giữ số thô như cũ, en có số nhiều", () => {
    const t = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "admin.metrics.chart" });
    expect(t("vi")("value", { value: 1234 })).toBe("1234 lượt");
    expect(t("en")("value", { value: 1 })).toBe("1 call");
    expect(t("en")("value", { value: 1234 })).toBe("1,234 calls");
  });
});
