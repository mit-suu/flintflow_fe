import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import { fetchCheckout, type PaymentIntentDTO } from "@/lib/api/billing";
import CheckoutPage from "./page";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const searchParams = vi.hoisted(() => ({ intentId: "intent_1" as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/home/billing/checkout",
  useSearchParams: () => new URLSearchParams(searchParams.intentId ? { intentId: searchParams.intentId } : {}),
}));

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/lib/api/notifications", () => ({ emitNotificationsChanged: vi.fn() }));
vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/billing")>();
  return {
    ...actual,
    fetchCheckout: vi.fn(),
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

const makeIntent = (status: PaymentIntentDTO["status"]): PaymentIntentDTO => ({
  intentId: "intent_1",
  packageId: "pack_100",
  credits: 100,
  amount: 40_000,
  currency: "VND",
  status,
  referenceCode: status === "succeeded" ? "REF-100" : null,
  paymentDescription: "FF INTENT1",
  qrCodeUrl: null,
  processedAt: status === "succeeded" ? "2026-11-14T10:00:00.000Z" : null,
  createdAt: "2026-11-14T09:59:00.000Z",
});

describe("CheckoutPage", () => {
  beforeEach(() => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "lead" };
    activeOrg.loading = false;
    activeOrg.error = false;
    searchParams.intentId = "intent_1";
    router.push.mockReset();
    router.replace.mockReset();
    vi.mocked(fetchCheckout).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Viewer ⇒ chuyển hướng về /home và không gọi fetchCheckout", () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "viewer" };
    renderWithIntl(<CheckoutPage />);

    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(fetchCheckout).not.toHaveBeenCalled();
  });

  it("Analyst ⇒ chuyển hướng về /home/billing và không gọi fetchCheckout", () => {
    activeOrg.value = { id: "org-1", name: "Nhóm A", role: "analyst" };
    renderWithIntl(<CheckoutPage />);

    expect(router.replace).toHaveBeenCalledWith("/home/billing");
    expect(fetchCheckout).not.toHaveBeenCalled();
  });

  it("đang tải tổ chức (cold load) ⇒ không gọi fetchCheckout", () => {
    activeOrg.loading = true;
    renderWithIntl(<CheckoutPage />);

    expect(router.replace).not.toHaveBeenCalled();
    expect(fetchCheckout).not.toHaveBeenCalled();
    expect(screen.getByText("Đang tải…")).toBeInTheDocument();
  });

  it("tải tổ chức lỗi ⇒ không gọi fetchCheckout và hiện lỗi (fail closed)", () => {
    activeOrg.value = null;
    activeOrg.error = true;
    renderWithIntl(<CheckoutPage />);

    expect(router.replace).not.toHaveBeenCalled();
    expect(fetchCheckout).not.toHaveBeenCalled();
    expect(screen.getByText("Không thể tải giao dịch")).toBeInTheDocument();
  });

  it.each([
    { status: 401, code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
    { status: 403, code: "FORBIDDEN", message: "Bạn không có quyền xem giao dịch này." },
    { status: 404, code: "INTENT_NOT_FOUND", message: "Không tìm thấy giao dịch." },
  ])("Lead gặp lỗi $status ⇒ dừng poll, chỉ gọi fetchCheckout 1 lần", async ({ status, code, message }) => {
    vi.useFakeTimers();
    vi.mocked(fetchCheckout).mockRejectedValue(new ApiClientError(status, code, message));

    renderWithIntl(<CheckoutPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchCheckout).toHaveBeenCalledTimes(1);
    expect(screen.getByText(message)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchCheckout).toHaveBeenCalledTimes(1);
  });

  it("Lead: fetchCheckout trả pending rồi succeeded ⇒ poll lại và hiện kết quả thành công", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchCheckout)
      .mockResolvedValueOnce(makeIntent("pending"))
      .mockResolvedValueOnce(makeIntent("succeeded"));

    renderWithIntl(<CheckoutPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchCheckout).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Đang chờ xác nhận thanh toán…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(fetchCheckout).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Thanh toán thành công - đã cộng 100 credit vào tài khoản.")).toBeInTheDocument();
  });

  it("Lead gặp lỗi tạm thời 500 ⇒ vẫn poll lại sau 4s", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchCheckout)
      .mockRejectedValueOnce(new ApiClientError(500, "INTERNAL_ERROR", "Lỗi tạm thời"))
      .mockResolvedValueOnce(makeIntent("succeeded"));

    renderWithIntl(<CheckoutPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchCheckout).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(fetchCheckout).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Thanh toán thành công - đã cộng 100 credit vào tài khoản.")).toBeInTheDocument();
  });
});
