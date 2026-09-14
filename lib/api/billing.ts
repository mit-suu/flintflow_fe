/**
 * Khung API billing (mock gateway) — endpoint theo T04; T04 chốt shape response khi BE merge.
 */
import { apiCall } from "./client";

export interface CreditLedgerEntry {
  _id: string;
  type: string;
  amount: number;
  createdAt: string;
}

export interface BillingBalance {
  balance: number;
  reserved: number;
  plan: string;
  ledger: CreditLedgerEntry[];
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  amount: number;
}

export interface CheckoutResult {
  intentId: string;
  redirectUrl: string;
}

export const getBillingBalance = () => apiCall<BillingBalance>("/billing/balance");

export const listCreditPackages = () => apiCall<CreditPackage[]>("/billing/packages");

export const checkoutPackage = (packageId: string) =>
  apiCall<CheckoutResult>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });

export const upgradePlan = (plan: string) =>
  apiCall<unknown>("/billing/upgrade", { method: "POST", body: JSON.stringify({ plan }) });

export const listCreditTransactions = (page = 1) =>
  apiCall<CreditLedgerEntry[]>(`/billing/transactions?page=${page}`);
