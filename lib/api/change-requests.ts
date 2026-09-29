/**
 * Change request mode 1 (#16–#30 `docs/api/import-change-contract.md`). Mọi hành động trả `CrDetail` mới nhất.
 */
import type {
  CreateCrRequest,
  Cr,
  CrDetail,
  CrStatus,
  GroupDecisionRequest,
  OwnerStepDraftRequest,
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

/** Câu trả lời được để trống (= chưa biết — phase 7). */
export const answerClarifications = (projectId: string, crId: string, answers: string[]) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/answers`, post({ answers }));

/** Phase 8 (chat): gộp thêm một lệnh sửa vào CR chưa nộp — sau `draft` BE chạy lại làm rõ ngay. */
export const amendCr = (projectId: string, crId: string, instruction: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/amend`, post({ instruction }));

/** Phase 7: đính kèm đoạn văn bản nguồn (chỉ khi CR ở `draft` / `awaiting_answers`). */
export const addCrMaterialText = (projectId: string, crId: string, body: { name: string; text: string }) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/materials`, post(body));

/** Phase 7: upload file (.docx/.pdf/.txt/.md/PNG/JPEG) — BE tách chữ, ảnh nhờ AI đọc (1 credit). */
export const addCrMaterialFile = (projectId: string, crId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiCall<CrDetail>(`${cr(projectId, crId)}/materials`, { method: "POST", body: form });
};

export const deleteCrMaterial = (projectId: string, crId: string, materialId: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" });

export const patchLocation = (projectId: string, crId: string, locationId: string, body: PatchLocationRequest) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/locations/${encodeURIComponent(locationId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** BPMN 3.9 (mode 1 v3): CR `manual_fix` ⇒ sửa đề xuất một vị trí bằng skill của step sở hữu, theo hướng của BA. */
export const draftInOwnerStep = (projectId: string, crId: string, locationId: string, body: OwnerStepDraftRequest) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/locations/${encodeURIComponent(locationId)}/owner-step-draft`, post(body));

export const decideGroup = (projectId: string, crId: string, groupId: string, body: GroupDecisionRequest) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/groups/${encodeURIComponent(groupId)}/decision`, post(body));

export const closeCr = (projectId: string, crId: string, reason: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/close`, post({ reason }));

export const cancelCr = (projectId: string, crId: string, reason: string) =>
  apiCall<CrDetail>(`${cr(projectId, crId)}/cancel`, post({ reason }));
