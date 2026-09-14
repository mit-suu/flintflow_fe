import { apiCall } from "@/lib/api";

export type PlanId = "free" | "pro";
export type CreditTransactionType = "reserve" | "deduct" | "release" | "monthly_reset" | "purchase";
export type PaymentIntentStatus = "pending" | "succeeded" | "failed";
export type MockPaymentResult = "success" | "failed";

export interface CreditTransaction {
  _id: string;
  actionType: string;
  amount: number;
  type: CreditTransactionType;
  balanceAfter: number;
  state?: "reserved" | "deducted" | "refunded" | "expired";
  expires_at?: string;
  createdAt: string;
}

export interface BalanceResponse {
  balance: number;
  reserved: number;
  available: number;
  plan: PlanId;
  planLabel: string;
  lowCreditThreshold: number;
  subscription: {
    plan: PlanId;
    status: string;
    monthlyCreditsAllotment: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  ledger: CreditTransaction[];
}

export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  amount: number;
  currency: string;
}

export interface PlanDefinition {
  id: PlanId;
  label: string;
  initialCredits: number;
  monthlyCredits: number;
  priceVnd: number;
}

export interface PaymentIntentDTO {
  intentId: string;
  packageId: string;
  credits: number;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  processedAt: string | null;
  createdAt: string;
}

export interface CheckoutResponse extends PaymentIntentDTO {
  redirectUrl: string;
}

export interface CheckoutDetail extends PaymentIntentDTO {
  mockSignatures: Record<MockPaymentResult, string> | null;
}

export interface MockWebhookResult {
  intentId: string;
  status: PaymentIntentStatus;
  alreadyProcessed: boolean;
  creditsAdded: number;
  balance?: number;
}

export interface TransactionsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const unwrap = <T>(data: T | null, what: string): T => {
  if (data === null) throw new Error(`Không nhận được dữ liệu ${what}`);
  return data;
};

export async function fetchBalance(): Promise<BalanceResponse> {
  const res = await apiCall<BalanceResponse>("/billing/balance");
  return unwrap(res.data, "số dư");
}

export async function fetchPackages(): Promise<{ packages: CreditPackage[]; plans: PlanDefinition[] }> {
  const res = await apiCall<{ packages: CreditPackage[]; plans: PlanDefinition[] }>("/billing/packages");
  return unwrap(res.data, "gói credit");
}

export async function createCheckout(packageId: string): Promise<CheckoutResponse> {
  const res = await apiCall<CheckoutResponse>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return unwrap(res.data, "thanh toán");
}

export async function fetchCheckout(intentId: string): Promise<CheckoutDetail> {
  const res = await apiCall<CheckoutDetail>(`/billing/checkout/${intentId}`);
  return unwrap(res.data, "giao dịch");
}

/**
 * Trang mock checkout đóng vai cổng thanh toán gọi webhook. Chữ ký gửi trong
 * body vì CORS của BE không cho header tuỳ biến từ trình duyệt.
 */
export async function submitMockPayment(
  intentId: string,
  status: MockPaymentResult,
  signature: string
): Promise<MockWebhookResult> {
  const res = await apiCall<MockWebhookResult>("/billing/webhook/mock", {
    method: "POST",
    body: JSON.stringify({ intentId, status, signature }),
  });
  return unwrap(res.data, "webhook");
}

export async function upgradePlan(plan: PlanId) {
  const res = await apiCall<{ plan: PlanId; status: string; currentPeriodEnd: string }>("/billing/upgrade", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
  return unwrap(res.data, "gói");
}

export async function fetchTransactions(page = 1, limit = 20) {
  const res = await apiCall<CreditTransaction[]>(`/billing/transactions?page=${page}&limit=${limit}`);
  return {
    items: res.data ?? [],
    meta: res.meta as unknown as TransactionsMeta,
  };
}

export const formatVnd = (amount: number) => `${amount.toLocaleString("vi-VN")} ₫`;
