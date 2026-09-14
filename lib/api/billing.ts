import { apiCall } from "./client";

export type PlanId = "free" | "pro";
export type CreditTransactionType = "reserve" | "deduct" | "release" | "monthly_reset" | "purchase";
export type PaymentIntentStatus = "pending" | "succeeded" | "failed";

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
  /** Mã đối chiếu giao dịch ngân hàng do payment_service sinh */
  referenceCode: string | null;
  /** Nội dung chuyển khoản — hiển thị nguyên văn, không tự sửa */
  paymentDescription: string | null;
  /** Ảnh VietQR */
  qrCodeUrl: string | null;
  processedAt: string | null;
  createdAt: string;
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

/** Tạo order thanh toán (BE gọi payment_service; API key không bao giờ ra trình duyệt). */
export async function createCheckout(packageId: string): Promise<PaymentIntentDTO> {
  const res = await apiCall<PaymentIntentDTO>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return unwrap(res.data, "thanh toán");
}

/** Trạng thái giao dịch — dùng để polling trên trang QR. */
export async function fetchCheckout(intentId: string): Promise<PaymentIntentDTO> {
  const res = await apiCall<PaymentIntentDTO>(`/billing/checkout/${intentId}`);
  return unwrap(res.data, "giao dịch");
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
