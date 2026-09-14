import { apiCall } from "./client";
import type { CreditTransaction } from "./billing";

export type AdminUserRole = "user" | "admin";
export type AiCostGroupBy = "day" | "actionType" | "provider" | "user";

export interface AdminUser {
  _id: string;
  email: string;
  name: string | null;
  role: AdminUserRole;
  isActive: boolean;
  emailVerified: boolean;
  authProvider: string;
  createdAt: string;
  walletBalance: number;
  projectsCount: number;
  lastLoginAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  wallet: { balance: number; reserved: number } | null;
  recentTransactions: CreditTransaction[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminMetrics {
  usersTotal: number;
  usersNew7d: number;
  projectsTotal: number;
  projectsActive7d: number;
  baselinesTotal: number;
  aiCallsToday: number;
  aiCalls7d: number;
  /** Tỉ lệ 0..1 */
  aiFailRate7d: number;
}

export interface AiCostRow {
  key: string;
  label: string;
  calls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  credits: number;
  estimatedUsd: number;
}

export interface AiCostReport {
  from: string;
  to: string;
  groupBy: AiCostGroupBy;
  currency: string;
  pricingNote: string;
  rows: AiCostRow[];
  totals: Omit<AiCostRow, "key" | "label">;
}

export interface FetchUsersParams {
  page?: number;
  limit?: number;
  role?: AdminUserRole;
  isActive?: boolean;
  q?: string;
}

export interface FetchAiCostParams {
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  groupBy?: AiCostGroupBy;
}

const unwrap = <T>(data: T | null, what: string): T => {
  if (data === null) throw new Error(`Không nhận được dữ liệu ${what}`);
  return data;
};

const toQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
};

export async function fetchAdminUsers(params: FetchUsersParams = {}) {
  const res = await apiCall<AdminUser[]>(`/admin/users${toQuery({ ...params })}`);
  return {
    items: res.data ?? [],
    meta: res.meta as unknown as PageMeta,
  };
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await apiCall<AdminUserDetail>(`/admin/users/${id}`);
  return unwrap(res.data, "người dùng");
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  const res = await apiCall<AdminMetrics>("/admin/metrics");
  return unwrap(res.data, "số liệu");
}

export async function fetchAiCost(params: FetchAiCostParams = {}): Promise<AiCostReport> {
  const res = await apiCall<AiCostReport>(`/admin/ai-cost${toQuery({ ...params })}`);
  return unwrap(res.data, "chi phí AI");
}

export async function fetchAdminFeedback(): Promise<unknown[]> {
  const res = await apiCall<unknown[]>("/admin/feedback");
  return res.data ?? [];
}

export const formatNumber = (value: number) => value.toLocaleString("vi-VN");

export const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
