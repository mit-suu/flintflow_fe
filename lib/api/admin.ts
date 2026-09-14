/**
 * Khung API admin — prompt template (endpoint hiện có) + read-only 10.1–10.3 theo T06.
 * T06 chốt shape response khi BE merge.
 */
import { apiCall } from "./client";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  balance?: number;
  projectsCount?: number;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AdminUserQuery {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  q?: string;
}

export interface AdminMetrics {
  usersTotal: number;
  usersNew7d: number;
  projectsTotal: number;
  projectsActive7d: number;
  baselinesTotal: number;
  aiCallsToday: number;
  aiFailRate7d: number;
}

export interface AiCostQuery {
  from?: string;
  to?: string;
  groupBy?: "day" | "actionType" | "provider" | "user";
}

const toQueryString = (query: object) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const listAdminUsers = (query: AdminUserQuery = {}) =>
  apiCall<AdminUser[]>(`/admin/users${toQueryString(query)}`);

export const getAdminUser = (userId: string) => apiCall<AdminUser>(`/admin/users/${userId}`);

export const getAdminMetrics = () => apiCall<AdminMetrics>("/admin/metrics");

export const getAiCost = (query: AiCostQuery = {}) =>
  apiCall<unknown>(`/admin/ai-cost${toQueryString(query)}`);

export const listAdminFeedback = () => apiCall<unknown[]>("/admin/feedback");

export const listPromptTemplates = () => apiCall<unknown[]>("/admin/prompt-templates");

export const getPromptTemplate = (actionType: string) =>
  apiCall<unknown>(`/admin/prompt-templates/${actionType}`);

export const getPromptTemplateHistory = (actionType: string) =>
  apiCall<unknown[]>(`/admin/prompt-templates/${actionType}/history`);
