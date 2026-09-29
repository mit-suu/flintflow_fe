import { apiCall } from "./client";
import type { CreditTransaction } from "./billing";
import type { FeedbackCategory } from "./feedback";
import type { OrgRole } from "@/types/organization";

export type AdminUserRole = "user" | "admin";
export type AiCostGroupBy = "day" | "actionType" | "provider" | "user";

export interface AdminUser {
  _id: string;
  email: string;
  name: string | null;
  role: AdminUserRole;
  isActive: boolean;
  /** UC-66: thời điểm và lý do khoá; null khi đang hoạt động. */
  suspendedAt: string | null;
  suspendReason: string | null;
  emailVerified: boolean;
  authProvider: string;
  createdAt: string;
  /** task-26: ví thuộc tổ chức, không thuộc người ⇒ BE không còn trả `walletBalance`. */
  organizationsCount: number;
  projectsCount: number;
  lastLoginAt: string | null;
}

/** UC-65: một tổ chức người này tham gia, kèm ví của tổ chức đó (null nếu org chưa có ví). */
export interface AdminUserOrganization {
  id: string;
  name: string;
  role: OrgRole;
  joinedAt: string;
  wallet: { balance: number; reserved: number } | null;
}

export interface AdminUserDetail extends AdminUser {
  organizations: AdminUserOrganization[];
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

export interface AdminUserStatus {
  _id: string;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
}

/**
 * UC-66 khoá (bắt buộc lý do) / UC-67 mở khoá. Khoá thì BE thu hồi mọi phiên của tài khoản;
 * tự khoá chính mình ⇒ `ApiClientError` code `CANNOT_SUSPEND_SELF`.
 */
export async function setAdminUserStatus(
  id: string,
  body: { isActive: false; reason: string } | { isActive: true }
): Promise<AdminUserStatus> {
  const res = await apiCall<AdminUserStatus>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return unwrap(res.data, "trạng thái tài khoản");
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  const res = await apiCall<AdminMetrics>("/admin/metrics");
  return unwrap(res.data, "số liệu");
}

export async function fetchAiCost(params: FetchAiCostParams = {}): Promise<AiCostReport> {
  const res = await apiCall<AiCostReport>(`/admin/ai-cost${toQuery({ ...params })}`);
  return unwrap(res.data, "chi phí AI");
}

/** Một góp ý (BE `feedback.service.listFeedback`): mới nhất trước, `user` null nếu tài khoản đã xoá. */
export interface AdminFeedbackItem {
  _id: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
  user: { _id: string; email: string; name: string | null } | null;
}

export async function fetchAdminFeedback(): Promise<AdminFeedbackItem[]> {
  const res = await apiCall<AdminFeedbackItem[]>("/admin/feedback");
  return res.data ?? [];
}

export const formatNumber = (value: number) => value.toLocaleString("vi-VN");

export const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
