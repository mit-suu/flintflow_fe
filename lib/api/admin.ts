import { apiCall } from "./client";
import type { CreditTransaction } from "./billing";
import type { FeedbackCategory } from "./feedback";
import type { OrgRole } from "@/types/organization";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

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

/**
 * BE trả `data: null` là lỗi lạ của máy chủ chứ không phải câu cho người: message mang mã kỹ thuật để
 * `userErrorMessage` thay bằng câu dự phòng đã dịch của trang gọi.
 */
const unwrap = <T>(data: T | null, endpoint: string): T => {
  if (data === null) throw new Error(`EMPTY_RESPONSE ${endpoint}`);
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
  return unwrap(res.data, "GET /admin/users/:id");
}

export interface AdminUserStatus {
  _id: string;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  reactivatedAt: string | null;
  reactivateReason: string | null;
}

/**
 * UC-60 khoá / UC-61 mở khoá — cả hai bắt buộc lý do. Khoá thì BE thu hồi mọi phiên của tài khoản;
 * tự khoá chính mình ⇒ `ApiClientError` code `CANNOT_SUSPEND_SELF`; đã ở trạng thái đó ⇒ 409
 * `USER_ALREADY_SUSPENDED` / `USER_ALREADY_ACTIVE`.
 */
export async function setAdminUserStatus(
  id: string,
  body: { isActive: boolean; reason: string }
): Promise<AdminUserStatus> {
  const res = await apiCall<AdminUserStatus>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return unwrap(res.data, "PATCH /admin/users/:id/status");
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  const res = await apiCall<AdminMetrics>("/admin/metrics");
  return unwrap(res.data, "GET /admin/metrics");
}

export async function fetchAiCost(params: FetchAiCostParams = {}): Promise<AiCostReport> {
  const res = await apiCall<AiCostReport>(`/admin/ai-cost${toQuery({ ...params })}`);
  return unwrap(res.data, "GET /admin/ai-cost");
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

/** FLF-278: heading của mẫu bắt buộc thành mục riêng (BE `import/template-gaps.ts`). */
export interface TemplateGapRow {
  key: string;
  samples: string[];
  projects: number;
  empty: number;
  suggested_destination: string | null;
}

export async function fetchTemplateGaps(limit = 100): Promise<{ projects: number; rows: TemplateGapRow[] }> {
  const res = await apiCall<{ projects: number; rows: TemplateGapRow[] }>(`/admin/template-gaps?limit=${limit}`);
  return res.data ?? { projects: 0, rows: [] };
}

export type AdminOrgPlan = "free" | "pro";

/** UC-90: một tổ chức trong danh sách admin (BE `admin.service.listOrgs`). */
export interface AdminOrg {
  id: string;
  name: string;
  /** Người tạo org; null nếu tài khoản đã xoá. */
  owner: { id: string; email: string; name: string | null } | null;
  /** Gói active; không có gói trả phí ⇒ `free`. */
  plan: AdminOrgPlan;
  planLabel: string;
  /** null = org cũ chưa có ví — lần điều chỉnh đầu (UC-68) sẽ tạo ví. */
  wallet: { balance: number; reserved: number; available: number } | null;
  membersCount: number;
  /** Dự án chưa xoá. */
  projectsCount: number;
  createdAt: string;
}

export interface FetchOrgsParams {
  page?: number;
  limit?: number;
  plan?: AdminOrgPlan;
  /** Tên tổ chức hoặc email người tạo */
  q?: string;
}

export async function fetchAdminOrgs(params: FetchOrgsParams = {}) {
  const res = await apiCall<AdminOrg[]>(`/admin/orgs${toQuery({ ...params })}`);
  return {
    items: res.data ?? [],
    meta: res.meta as unknown as PageMeta,
  };
}

export interface AdjustOrgCreditsResult {
  organizationId: string;
  organizationName: string;
  amount: number;
  balance: number;
  reserved: number;
  reason: string;
}

/**
 * UC-68 — cộng (`amount` > 0) hoặc trừ (`amount` < 0) credit trong ví tổ chức, bắt buộc lý do. Trừ quá phần
 * khả dụng (balance − reserved) ⇒ 409 `INSUFFICIENT_CREDIT`; org không tồn tại ⇒ 404 `ORG_NOT_FOUND`.
 */
export async function adjustAdminOrgCredits(
  orgId: string,
  body: { amount: number; reason: string }
): Promise<AdjustOrgCreditsResult> {
  const res = await apiCall<AdjustOrgCreditsResult>(`/admin/orgs/${orgId}/credits`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return unwrap(res.data, "PATCH /admin/orgs/:id/credits");
}

/** Thẻ BCP 47 cho `toLocaleString` theo ngôn ngữ giao diện — `vi` giữ nguyên cách hiển thị cũ (`vi-VN`). */
const LOCALE_TAG: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

/** Số theo ngôn ngữ giao diện (component truyền `useLocale()`): `1.234` ở vi, `1,234` ở en. */
export const formatNumber = (value: number, locale: Locale = DEFAULT_LOCALE) => value.toLocaleString(LOCALE_TAG[locale]);

export const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const formatDateTime = (value: string | null, locale: Locale = DEFAULT_LOCALE) =>
  value ? new Date(value).toLocaleString(LOCALE_TAG[locale]) : "—";
