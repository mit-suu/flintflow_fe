import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import AppShell from "@/components/layout/AppShell";
import BillingPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/home/billing" }));
vi.mock("@/lib/api/notifications", () => ({ emitNotificationsChanged: vi.fn(), onNotificationsChanged: () => () => {} }));
vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/billing")>();
  return {
    ...actual,
    fetchBalance: vi.fn(async () => ({ balance: 300, available: 300, reserved: 0, plan: "free", planLabel: "Free", lowCreditThreshold: 10, subscription: null })),
    fetchPackages: vi.fn(async () => ({
      packages: [{ id: "pack_100", label: "Gói 100 credit", credits: 100, amount: 40000 }],
      plans: [
        { id: "free", label: "Free", monthlyCredits: 300, priceVnd: 0 },
        { id: "pro", label: "Pro", monthlyCredits: 1000, priceVnd: 199000 },
      ],
    })),
    fetchTransactions: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
    createCheckout: vi.fn(),
    upgradePlan: vi.fn(),
  };
});
const activeOrg = vi.hoisted(() => ({ value: null as null | { id: string; name: string; role: "lead" | "analyst" | "viewer" } }));
vi.mock("@/lib/hooks/use-active-org", () => ({ useActiveOrganization: () => activeOrg.value }));

beforeEach(() => {
  activeOrg.value = null;
});

describe("trang thanh toán theo vai trò trong tổ chức", () => {
  it("Analyst không thấy nút mua, thấy lời giải thích ai được nạp", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "analyst" };
    renderWithIntl(<AppShell sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByText("Gói 100 credit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mua ngay" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mua gói Pro/ })).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Chỉ Lead của tổ chức mới nạp credit");
  });

  it("Lead thấy đủ nút mua và không có lời nhắc", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    renderWithIntl(<AppShell sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mua gói Pro/ })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("chưa biết vai trò thì vẫn hiện nút — BE vẫn chặn, Lead không bị mất nút", async () => {
    renderWithIntl(<AppShell sidebar={<div />}><BillingPage /></AppShell>);
    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
  });
});
