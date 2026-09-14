/**
 * Cờ đỏ/vàng và waiver — theo danh sách endpoint T08/T09; chốt payload ở T16.
 */
import type { Flag, ListFlagsQuery } from "@/types/flags";
import { apiCall } from "./client";

export const listFlags = (projectId: string, query: ListFlagsQuery = {}) => {
  const params = new URLSearchParams();
  if (query.level) params.set("level", query.level);
  if (query.open !== undefined) params.set("open", String(query.open));
  const qs = params.toString();
  return apiCall<Flag[]>(`/projects/${projectId}/flags${qs ? `?${qs}` : ""}`);
};

export const recomputeFlags = (projectId: string) =>
  apiCall<Flag[]>(`/projects/${projectId}/flags/recompute`, { method: "POST" });

/** `reason` do user gõ, BE yêu cầu ≥ 20 ký tự. */
export const waiveFlag = (projectId: string, flagId: string, reason: string) =>
  apiCall<Flag>(`/projects/${projectId}/flags/${flagId}/waive`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
