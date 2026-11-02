import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import type { Locale } from "@/lib/i18n";
import { apiCall } from "./client";
import { currentLocale } from "./error-messages";

export type PlanId = "free" | "pro";
/** `payment`: thanh toán đang chờ / lỗi (UC-59) — chỉ Lead nhận, không phải dòng sổ ví. */
export type CreditTransactionType = "reserve" | "deduct" | "release" | "refund" | "monthly_reset" | "purchase" | "admin_adjust" | "payment";
export type PaymentIntentStatus = "pending" | "succeeded" | "failed";

/** Thành viên / dự án của một dòng lịch sử — `name` rỗng khi đã bị xoá. */
export interface NamedRef {
  id: string;
  name: string;
}

export interface CreditTransaction {
  _id: string;
  actionType: string;
  amount: number;
  type: CreditTransactionType;
  /** `null` ở dòng thanh toán chưa thành công (chưa đụng ví). */
  balanceAfter: number | null;
  state?: "reserved" | "deducted" | "refunded" | "expired";
  expires_at?: string;
  createdAt: string;
  /** UC-60: step pipeline của lượt gọi AI; `null` khi gọi ngoài pipeline hoặc dòng cũ. */
  stepId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  member?: NamedRef | null;
  project?: NamedRef | null;
  /** UC-59: dòng `purchase` (= succeeded) và dòng `payment` (pending / failed). */
  paymentStatus?: PaymentIntentStatus;
  intentId?: string;
  packageId?: string;
  /** Số tiền (VND) của dòng `payment`. */
  price?: number;
}

export type TransactionKind = "usage" | "payment";

export interface TransactionFilters {
  kind?: TransactionKind;
  projectId?: string;
  memberId?: string;
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

type BillingData = "balance" | "packages" | "checkout" | "transaction" | "plan";

/** BE trả `data: null` ⇒ câu lỗi theo ngôn ngữ UI (`common.billingData`). */
const unwrap = <T>(data: T | null, what: BillingData): T => {
  if (data === null) {
    const locale = currentLocale();
    const t = createTranslator({ locale, messages: { vi, en }[locale], namespace: "common.billingData" });
    throw new Error(t("missing", { what: t(`what.${what}`) }));
  }
  return data;
};

export async function fetchBalance(): Promise<BalanceResponse> {
  const res = await apiCall<BalanceResponse>("/billing/balance");
  return unwrap(res.data, "balance");
}

export async function fetchPackages(): Promise<{ packages: CreditPackage[]; plans: PlanDefinition[] }> {
  const res = await apiCall<{ packages: CreditPackage[]; plans: PlanDefinition[] }>("/billing/packages");
  return unwrap(res.data, "packages");
}

/** Tạo order thanh toán (BE gọi payment_service; API key không bao giờ ra trình duyệt). */
export async function createCheckout(packageId: string): Promise<PaymentIntentDTO> {
  const res = await apiCall<PaymentIntentDTO>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return unwrap(res.data, "checkout");
}

/** Trạng thái giao dịch — dùng để polling trên trang QR. */
export async function fetchCheckout(intentId: string): Promise<PaymentIntentDTO> {
  const res = await apiCall<PaymentIntentDTO>(`/billing/checkout/${intentId}`);
  return unwrap(res.data, "transaction");
}

export async function upgradePlan(plan: PlanId) {
  const res = await apiCall<{ plan: PlanId; status: string; currentPeriodEnd: string }>("/billing/upgrade", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
  return unwrap(res.data, "plan");
}

export async function fetchTransactions(page = 1, limit = 20, filters: TransactionFilters = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const res = await apiCall<CreditTransaction[]>(`/billing/transactions?${query}`);
  return {
    items: res.data ?? [],
    meta: res.meta as unknown as TransactionsMeta,
  };
}

/** Giá VND theo ngôn ngữ giao diện: `40.000 ₫` (vi) / `40,000 ₫` (en). */
export const formatVnd = (amount: number, locale: Locale = "vi") =>
  `${amount.toLocaleString(locale === "en" ? "en-US" : "vi-VN")} ₫`;

// ─── FLF-332 (BR-08): Analyst báo Lead nạp credit ───

export interface TopupRequest {
  id: string;
  organization_id: string;
  user_id: string;
  project_id: string | null;
  step: string | null;
  needed: number | null;
  status: "open" | "fulfilled";
  /** Số Lead vừa được báo (0 khi yêu cầu đã mở từ trước — chỉ cập nhật). */
  notified_leads: number;
  available: number;
  created_at: string;
  fulfilled_at: string | null;
}

/** Tạo / cập nhật yêu cầu nạp credit của người gọi trong org đang chọn; BE báo in-app mọi Lead. */
export const requestCreditTopup = (body: { projectId?: string; step?: string; needed?: number } = {}) =>
  apiCall<TopupRequest>("/billing/topup-request", { method: "POST", body: JSON.stringify(body) });
