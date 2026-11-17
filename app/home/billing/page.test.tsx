import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import TopBar from "@/components/layout/TopBar";
import AppShell from "@/components/layout/AppShell";
import BillingPage from "./page";
import { fetchBalance, fetchPackages, fetchTransactions } from "@/lib/api/billing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/home/billing" }));
vi.mock("@/lib/api/orgs", () => ({
  fetchMembers: vi.fn(async () => [{ userId: "u1", email: "lan@example.com", name: "Lan", role: "lead", joinedAt: "" }]),
}));
vi.mock("@/lib/api/projects", () => ({ listProjects: vi.fn(async () => ({ data: [{ _id: "p1", name: "Shop online" }] })) }));
vi.mock("@/lib/api/notifications", () => ({ emitNotificationsChanged: vi.fn(), onNotificationsChanged: () => () => {} }));
vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/billing")>();
  return {
    ...actual,
    fetchBalance: vi.fn(async () => ({
      balance: 300,
      available: 300,
      reserved: 0,
      plan: "free",
      planLabel: "Free",
      planLimits: { maxMembers: 3, maxProjects: 3, maxReferenceTokens: 200_000, monthlyCredits: 300 },
      lowCreditThreshold: 10,
      subscription: null,
    })),
    fetchPackages: vi.fn(async () => ({
      packages: [{ id: "pack_100", label: "Gói 100 credit", credits: 100, amount: 40000 }],
      plans: [
        { id: "free", label: "Free", monthlyCredits: 300, priceVnd: 0, maxMembers: 3, maxProjects: 3, maxReferenceTokens: 200_000 },
        { id: "pro", label: "Pro", monthlyCredits: 1000, priceVnd: 199000, maxMembers: 5, maxProjects: 50, maxReferenceTokens: 1_000_000 },
      ],
    })),
    fetchTransactions: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
    createCheckout: vi.fn(),
    upgradePlan: vi.fn(),
  };
});
const activeOrg = vi.hoisted(() => ({
  value: null as null | { id: string; name: string; role: "lead" | "analyst" | "viewer" },
  loading: false,
  error: false,
}));
vi.mock("@/lib/hooks/use-active-org", () => ({
  useActiveOrganization: () => activeOrg.value,
  useActiveOrganizationState: () => ({ org: activeOrg.value, loading: activeOrg.loading, error: activeOrg.error }),
}));

beforeEach(() => {
  activeOrg.value = null;
  activeOrg.loading = false;
  activeOrg.error = false;
  router.push.mockReset();
  router.replace.mockReset();
  vi.mocked(fetchBalance).mockClear();
  vi.mocked(fetchPackages).mockClear();
  vi.mocked(fetchTransactions).mockReset().mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
});

const page = (items: unknown[]) => ({ items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } });

/** Khung giữ chỗ cũng có nhãn "Gói hiện tại" (chữ cố định) ⇒ chờ nó đi rồi mới lấy thẻ gói hiện tại thật. */
const findCurrentPlanCard = async () => {
  await waitFor(() => expect(screen.queryByTestId("page-skeleton")).toBeNull());
  return screen.getByText("Gói hiện tại").parentElement!;
};
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

    const usageRow = (await screen.findByText("Trích xuất Brief")).closest("li")!;
    expect(within(usageRow).getByText("Shop online")).toBeInTheDocument();
    expect(within(usageRow).getByText("Lan")).toBeInTheDocument();
    expect(within(usageRow).getByText("1.200 / 300")).toBeInTheDocument();

    expect(screen.getByText("Đang chờ")).toBeInTheDocument();
    expect(screen.getByText("Thất bại")).toBeInTheDocument();
    // Chỉ thanh toán đang chờ mới mở lại được mã QR
    const qr = screen.getAllByRole("button", { name: "Mở mã QR" });
    expect(qr).toHaveLength(1);
    fireEvent.click(qr[0]);
    expect(router.push).toHaveBeenCalledWith("/home/billing/checkout?intentId=i1");
  });

  it("Lead thấy giới hạn gói (UC-56) và chi tiết giao dịch nạp / nâng gói thành công (UC-59)", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchTransactions).mockResolvedValueOnce(
      page([
        {
          _id: "t-ok",
          type: "purchase",
          actionType: "purchase",
          amount: 100,
          balanceAfter: 400,
          createdAt: at,
          paymentStatus: "succeeded",
          intentId: "i-ok",
          packageId: "pack_100",
          price: 40000,
          currency: "VND",
          referenceCode: "REF-999",
          member: { id: "u1", name: "Lan" },
          project: null,
        },
        {
          _id: "t-pro",
          type: "purchase",
          actionType: "purchase",
          amount: 1000,
          balanceAfter: 1400,
          createdAt: at,
          paymentStatus: "succeeded",
          intentId: "i-pro",
          packageId: "plan:pro",
          price: 199000,
          currency: "VND",
          referenceCode: "REF-PRO",
          member: { id: "u1", name: "Lan" },
          project: null,
        },
      ]) as never
    );

    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    const currentPlanCard = await findCurrentPlanCard();
    expect(
      within(currentPlanCard).getByText("Tối đa 3 thành viên · 3 dự án · 200.000 token tài liệu tham khảo/dự án")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Tối đa 3 thành viên · 3 dự án · 200.000 token tài liệu tham khảo/dự án")).toHaveLength(2);
    expect(screen.getByText("Tối đa 5 thành viên · 50 dự án · 1.000.000 token tài liệu tham khảo/dự án")).toBeInTheDocument();

    const okRow = (await screen.findByText("Mã GD: REF-999")).closest("li")!;
    expect(within(okRow).getByText("Gói 100 credit")).toBeInTheDocument();
    expect(within(okRow).getByText("40.000 ₫")).toBeInTheDocument();
    expect(within(okRow).getByText("Thành công")).toBeInTheDocument();

    const proRow = screen.getByText("Mã GD: REF-PRO").closest("li")!;
    expect(within(proRow).getByText("Mua gói Pro")).toBeInTheDocument();
    expect(within(proRow).getByText("199.000 ₫")).toBeInTheDocument();
    expect(within(proRow).getByText("Thành công")).toBeInTheDocument();
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

  it("lịch sử nhiều trang ⇒ thanh số trang, bấm trang 2 tải đúng trang đó với bộ lọc hiện tại (FLF-404)", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    const row = (id: string) => ({ _id: id, type: "deduct", actionType: "draft", amount: 1, balanceAfter: 1, createdAt: at });
    vi.mocked(fetchTransactions).mockImplementation(async (p = 1) => ({
      items: [row(`p${p}`)],
      meta: { page: p, limit: 20, total: 45, totalPages: 3 },
    }) as never);
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByRole("navigation", { name: "Phân trang" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tới trang 2" }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenLastCalledWith(2, 20, {}));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tới trang 2" })).toHaveAttribute("aria-current", "page"));
    vi.mocked(fetchTransactions).mockReset();
  });
});

describe("trang thanh toán theo vai trò trong tổ chức", () => {
  it("Analyst không thấy nút mua, thấy lời giải thích ai được nạp, thấy giới hạn gói và không thấy tuỳ chọn Thanh toán trong bộ lọc Loại", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "analyst" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByText("Gói 100 credit")).toBeInTheDocument();
    expect(screen.getAllByText("Tối đa 3 thành viên · 3 dự án · 200.000 token tài liệu tham khảo/dự án").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tối đa 5 thành viên · 50 dự án · 1.000.000 token tài liệu tham khảo/dự án")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mua ngay" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mua gói Pro/ })).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Chỉ Lead của tổ chức mới nạp credit");

    fireEvent.click(screen.getByRole("combobox", { name: "Loại" }));
    expect(screen.getByRole("option", { name: "Sử dụng AI" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Thanh toán" })).toBeNull();
  });

  it("Viewer mở /home/billing ⇒ chuyển hướng về /home và không gọi API billing", () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "viewer" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(fetchPackages).not.toHaveBeenCalled();
    expect(fetchBalance).not.toHaveBeenCalled();
    expect(fetchTransactions).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Thanh toán & credit" })).toBeNull();
  });

  it("chuyển org từ Lead sang Viewer trong AppShell ⇒ xoá chip credit ở TopBar và chuyển hướng /home (Review Focus #5)", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    const { rerender } = renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}>
        <TopBar trail={["Trang chủ"]} />
        <BillingPage />
      </AppShell>
    );

    const chips = await screen.findAllByRole("link", { name: /credits/ });
    expect(chips[0]).toHaveTextContent("300");

    activeOrg.value = { id: "org-2", name: "Nhóm B", role: "viewer" };
    rerender(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}>
        <TopBar trail={["Trang chủ"]} />
        <BillingPage />
      </AppShell>
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/home"));
    expect(screen.getByText("Trang chủ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /credits/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Thanh toán & credit" })).toBeNull();
  });

  it("Lead thấy đủ nút mua và không có lời nhắc", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mua gói Pro/ })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("chưa biết vai trò thì vẫn hiện nút - BE vẫn chặn, Lead không bị mất nút", async () => {
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);
    expect(await screen.findByRole("button", { name: "Mua ngay" })).toBeInTheDocument();
  });

  it("đang tải tổ chức (cold load) ⇒ không gọi API billing và không hiện nút mua", () => {
    activeOrg.loading = true;
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(fetchPackages).not.toHaveBeenCalled();
    expect(fetchBalance).not.toHaveBeenCalled();
    expect(fetchTransactions).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Mua ngay" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mua gói/ })).toBeNull();
    expect(screen.queryByText("Chưa có giao dịch nào")).toBeNull();
  });

  it("tải tổ chức lỗi ⇒ không gọi API billing, hiện lỗi và ẩn nội dung billing (fail closed)", () => {
    activeOrg.error = true;
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(fetchPackages).not.toHaveBeenCalled();
    expect(fetchBalance).not.toHaveBeenCalled();
    expect(fetchTransactions).not.toHaveBeenCalled();
    expect(screen.getByText("Không thể tải thông tin thanh toán")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mua ngay" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Báo Lead nạp credit/ })).toBeNull();
    expect(screen.queryByText("Chưa có giao dịch nào")).toBeNull();
  });
});

describe("không hạ gói (FLF-347)", () => {
  it("đang dùng Pro còn hạn: thẻ Free không có nút chuyển, chỉ báo tự về Free khi hết kỳ", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchBalance).mockResolvedValueOnce({
      balance: 694,
      available: 694,
      reserved: 0,
      plan: "pro",
      planLabel: "Pro",
      lowCreditThreshold: 10,
      subscription: { plan: "pro", status: "active", monthlyCreditsAllotment: 1000, currentPeriodStart: "2026-10-14T00:00:00.000Z", currentPeriodEnd: "2026-11-13T00:00:00.000Z" },
    } as never);
    renderWithIntl(<AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>);

    expect(await screen.findByText("Tự về Free khi gói hiện tại hết hạn (13/11/2026)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chuyển sang/ })).toBeNull();
    expect(screen.getByText("Đang dùng")).toBeInTheDocument();
  });
});

describe("trang thanh toán - tiếng Anh", () => {
  it("thẻ gói credit, giới hạn gói và lịch sử nạp tiền không còn chữ tiếng Việt", async () => {
    activeOrg.value = { id: "org-1", name: "Team A", role: "lead" };
    vi.mocked(fetchTransactions).mockResolvedValueOnce(
      page([
        {
          _id: "t-en-pack",
          type: "purchase",
          actionType: "purchase",
          amount: 100,
          balanceAfter: 400,
          createdAt: at,
          paymentStatus: "succeeded",
          intentId: "i-en-1",
          packageId: "pack_100",
          price: 40000,
          currency: "VND",
          referenceCode: "REF-EN1",
          member: { id: "u1", name: "Lan" },
          project: null,
        },
        {
          _id: "t-en-pro",
          type: "purchase",
          actionType: "purchase",
          amount: 1000,
          balanceAfter: 1400,
          createdAt: at,
          paymentStatus: "succeeded",
          intentId: "i-en-2",
          packageId: "plan:pro",
          price: 199000,
          currency: "VND",
          referenceCode: "REF-EN2",
          member: { id: "u1", name: "Lan" },
          project: null,
        },
      ]) as never
    );
    const { container } = renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>,
      "en"
    );

    const enPackRow = (await screen.findByText("Ref: REF-EN1")).closest("li")!;
    expect(within(enPackRow).getByText("100-credit pack")).toBeInTheDocument();
    expect(within(enPackRow).getByText("40,000 ₫")).toBeInTheDocument();
    expect(within(enPackRow).getByText("Succeeded")).toBeInTheDocument();

    const enProRow = screen.getByText("Ref: REF-EN2").closest("li")!;
    expect(within(enProRow).getByText("Buy Pro plan")).toBeInTheDocument();
    expect(within(enProRow).getByText("199,000 ₫")).toBeInTheDocument();
    expect(within(enProRow).getByText("Succeeded")).toBeInTheDocument();

    expect(screen.getAllByText("100-credit pack").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("40,000 ₫").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Up to 3 members · 3 projects · 200,000 reference tokens/project")).toHaveLength(2);
    expect(screen.getByText("Up to 5 members · 50 projects · 1,000,000 reference tokens/project")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("dòng admin_adjust hiển thị dấu + / − và màu theo direction, giữ nguyên dòng cũ thiếu direction", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchTransactions).mockResolvedValueOnce(
      page([
        {
          _id: "t-adj-plus",
          type: "admin_adjust",
          actionType: "admin_adjust",
          amount: 50,
          direction: "credit",
          balanceAfter: 350,
          createdAt: at,
          member: { id: "u1", name: "Hiệp" },
          project: null,
        },
        {
          _id: "t-adj-minus",
          type: "admin_adjust",
          actionType: "admin_adjust",
          amount: 20,
          direction: "debit",
          balanceAfter: 330,
          createdAt: at,
          member: { id: "u1", name: "Hiệp" },
          project: null,
        },
        {
          _id: "t-adj-legacy",
          type: "admin_adjust",
          actionType: "admin_adjust",
          amount: 15,
          direction: null,
          balanceAfter: 345,
          createdAt: at,
          member: { id: "u1", name: "Hiệp" },
          project: null,
        },
      ]) as never
    );

    renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>
    );

    const plusCell = await screen.findByText("+50");
    expect(plusCell.className).toContain("text-success");

    const minusCell = screen.getByText("−20");
    expect(minusCell.className).toContain("text-error");

    const legacyCell = screen.getByText("15");
    expect(legacyCell.className).toContain("text-on-surface-variant");
  });
});

describe("gộp và fallback giới hạn gói (UC-56)", () => {
  it("gộp maxReferenceTokens từ plan definition khi balance.planLimits thiếu, và fallback copy cũ khi cả hai thiếu", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchBalance).mockResolvedValueOnce({
      balance: 300,
      available: 300,
      reserved: 0,
      plan: "free",
      planLabel: "Free",
      planLimits: { maxMembers: 3, maxProjects: 3, monthlyCredits: 300 },
      lowCreditThreshold: 10,
      subscription: null,
      ledger: [],
    });
    vi.mocked(fetchPackages).mockResolvedValueOnce({
      packages: [{ id: "pack_100", label: "Gói 100 credit", credits: 100, amount: 40000, currency: "VND" }],
      plans: [
        { id: "free", label: "Free", initialCredits: 300, monthlyCredits: 300, priceVnd: 0, maxMembers: 3, maxProjects: 3, maxReferenceTokens: 200_000 },
        { id: "pro", label: "Pro", initialCredits: 1000, monthlyCredits: 1000, priceVnd: 199000, maxMembers: 5, maxProjects: 50 },
      ],
    });

    renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>
    );

    const currentPlanCard = await findCurrentPlanCard();
    expect(
      within(currentPlanCard).getByText("Tối đa 3 thành viên · 3 dự án · 200.000 token tài liệu tham khảo/dự án")
    ).toBeInTheDocument();
    expect(screen.getByText("Tối đa 5 thành viên · 50 dự án")).toBeInTheDocument();
  });

  it("thẻ gói hiện tại fallback sang copy cũ khi cả balance.planLimits và plan definition thiếu maxReferenceTokens", async () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    vi.mocked(fetchBalance).mockResolvedValueOnce({
      balance: 300,
      available: 300,
      reserved: 0,
      plan: "free",
      planLabel: "Free",
      planLimits: { maxMembers: 3, maxProjects: 3, monthlyCredits: 300 },
      lowCreditThreshold: 10,
      subscription: null,
      ledger: [],
    });
    vi.mocked(fetchPackages).mockResolvedValueOnce({
      packages: [{ id: "pack_100", label: "Gói 100 credit", credits: 100, amount: 40000, currency: "VND" }],
      plans: [
        { id: "free", label: "Free", initialCredits: 300, monthlyCredits: 300, priceVnd: 0, maxMembers: 3, maxProjects: 3 },
      ],
    });

    renderWithIntl(
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={<div />}><BillingPage /></AppShell>
    );

    const currentPlanCard = await findCurrentPlanCard();
    expect(within(currentPlanCard).getByText("Tối đa 3 thành viên · 3 dự án")).toBeInTheDocument();
  });
});
