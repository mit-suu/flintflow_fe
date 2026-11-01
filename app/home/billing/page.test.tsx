import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import AppShell from "@/components/layout/AppShell";
import BillingPage from "./page";
import { fetchTransactions } from "@/lib/api/billing";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/home/billing" }));
vi.mock("@/lib/api/orgs", () => ({
  fetchMembers: vi.fn(async () => [{ userId: "u1", email: "lan@example.com", name: "Lan", role: "lead", joinedAt: "" }]),
}));
vi.mock("@/lib/api/projects", () => ({ listProjects: vi.fn(async () => ({ data: [{ _id: "p1", name: "Shop online" }] })) }));
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
  push.mockReset();
});

const page = (items: unknown[]) => ({ items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } });
const at = "2026-11-01T03:00:00.000Z";

describe("lịch sử credit (UC-59, UC-60)", () => {
  it("dòng dùng AI hiện dự án, step, thành viên, token; thanh toán đang chờ / lỗi có nhãn trạng thái và mở lại mã QR", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchTransactions).mockResolvedValueOnce(
      page([
        { _id: "t1", type: "deduct", actionType: "draft", amount: 4, balanceAfter: 296, createdAt: at, stepId: "S-1.1", tokensIn: 1200, tokensOut: 300, member: { id: "u1", name: "Lan" }, project: { id: "p1", name: "Shop online" } },
        { _id: "t2", type: "payment", actionType: "purchase", amount: 100, balanceAfter: null, createdAt: at, paymentStatus: "pending", intentId: "i1", packageId: "pack_100", price: 40000, member: { id: "u1", name: "Lan" }, project: null },
        { _id: "t3", type: "payment", actionType: "purchase", amount: 100, balanceAfter: null, createdAt: at, paymentStatus: "failed", intentId: "i2", packageId: "pack_100", price: 40000, member: { id: "u1", name: "Lan" }, project: null },
      ]) as never
    );
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    const usageRow = (await screen.findByText("Trích xuất Brief")).closest("tr")!;
    expect(within(usageRow).getByText("Shop online")).toBeInTheDocument();
    expect(within(usageRow).getByText("Lan")).toBeInTheDocument();
    expect(within(usageRow).getByText("1.200 / 300")).toBeInTheDocument();

    expect(screen.getByText("Đang chờ")).toBeInTheDocument();
    expect(screen.getByText("Thất bại")).toBeInTheDocument();
    // Chỉ thanh toán đang chờ mới mở lại được mã QR
    const qr = screen.getAllByRole("button", { name: "Mở mã QR" });
    expect(qr).toHaveLength(1);
    fireEvent.click(qr[0]);
    expect(push).toHaveBeenCalledWith("/home/billing/checkout?intentId=i1");
  });

  it("đổi bộ lọc ⇒ tải lại trang đầu với điều kiện lọc", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    fireEvent.click(await screen.findByRole("combobox", { name: "Loại" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Sử dụng AI" }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenLastCalledWith(1, 20, { kind: "usage" }));

    fireEvent.click(await screen.findByRole("combobox", { name: "Thành viên" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Lan" }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenLastCalledWith(1, 20, { kind: "usage", memberId: "u1" }));
    expect(await screen.findByText("Không có giao dịch nào khớp bộ lọc")).toBeInTheDocument();
  });
});

describe("trang thanh toán theo vai trò trong tổ chức", () => {
  it("Analyst không thấy nút mua, thấy lời giải thích ai được nạp", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "analyst" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByText("Gói 100 credit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mua ngay" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mua gói Pro/ })).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Chỉ Lead của tổ chức mới nạp credit");
  });

  it("Lead thấy đủ nút mua và không có lời nhắc", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mua gói Pro/ })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("chưa biết vai trò thì vẫn hiện nút — BE vẫn chặn, Lead không bị mất nút", async () => {
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);
    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
  });
});

describe("trang thanh toán — tiếng Anh", () => {
  it("thẻ gói credit không còn chữ tiếng Việt: tên gói, đơn vị, giá", async () => {
    activeOrg.value = { id: "org-1", name: "Team A", role: "lead" };
    const { container } = renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>,
      "en"
    );

    expect(await screen.findByText("100-credit pack")).toBeInTheDocument();
    expect(screen.getByText("40,000 ₫")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
