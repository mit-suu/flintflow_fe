/**
 * Change request mode 1 (#16–#30 `docs/api/import-change-contract.md`). Mọi hành động trả `CrDetail` mới nhất.
 */
import type {
  CreateCrRequest,
  Cr,
  CrDetail,
  CrStatus,
  GroupDecisionRequest,
  PatchLocationRequest,
} from "@/types/change-request";
import { apiCall } from "./client";

const crs = (projectId: string) => `/projects/${projectId}/change-requests`;
const cr = (projectId: string, crId: string) => `${crs(projectId)}/${encodeURIComponent(crId)}`;

const post = (body: unknown = {}): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const createCr = (projectId: string, body: CreateCrRequest) => apiCall<CrDetail>(crs(projectId), post(body));

/** Mới nhất trước. */
export const listCrs = (projectId: string, status?: CrStatus) =>
  apiCall<Cr[]>(status ? `${crs(projectId)}?status=${status}` : crs(projectId));

export const getCr = (projectId: string, crId: string) => apiCall<CrDetail>(cr(projectId, crId));

/** Các bước không có body: làm rõ (C-2), tìm vị trí + khoá (C-3), đề xuất (C-4), kiểm (C-5), nộp, sửa lại, resume. */
export type CrAction = "clarify" | "impact" | "propose" | "verify" | "submit" | "revise" | "resume";

export const runCrAction = (projectId: string, crId: string, action: CrAction) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/${action}`, post());

export const answerClarifications = (projectId: string, crId: string, answers: string[]) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/answers`, post({ answers }));

export const patchLocation = (projectId: string, crId: string, locationId: string, body: PatchLocationRequest) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/locations/${encodeURIComponent(locationId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const decideGroup = (projectId: string, crId: string, groupId: string, body: GroupDecisionRequest) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/groups/${encodeURIComponent(groupId)}/decision`, post(body));

export const closeCr = (projectId: string, crId: string, reason: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/close`, post({ reason }));

export const cancelCr = (projectId: string, crId: string, reason: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/cancel`, post({ reason }));
