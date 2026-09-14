/**
 * Spine, lịch sử thay đổi, hoà giải, undo, traceability — theo danh sách endpoint T08.
 * Chốt request/response theo `pipeline-contract.md` ở T12/T16.
 */
import type { ApplyResult, ChangeRequest } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import { ApiClientError, apiCall, authFetch, readErrorMessage } from "./client";

export const getSpine = (projectId: string) => apiCall<Spine>(`/projects/${projectId}/spine`);

export const listChanges = (projectId: string, range: { from?: number; to?: number } = {}) => {
  const params = new URLSearchParams();
  if (range.from !== undefined) params.set("from", String(range.from));
  if (range.to !== undefined) params.set("to", String(range.to));
  const query = params.toString();
  return apiCall<Change[]>(`/projects/${projectId}/changes${query ? `?${query}` : ""}`);
};

export const previewChanges = (projectId: string, request: ChangeRequest) =>
  apiCall<ApplyResult>(`/projects/${projectId}/changes/preview`, {
    method: "POST",
    body: JSON.stringify(request),
  });

export const applyChanges = (projectId: string, request: ChangeRequest) =>
  apiCall<ApplyResult>(`/projects/${projectId}/changes`, {
    method: "POST",
    body: JSON.stringify(request),
  });

export const reconcile = (projectId: string) =>
  apiCall<ApplyResult>(`/projects/${projectId}/reconcile`, { method: "POST" });

export const undoLastChange = (projectId: string) =>
  apiCall<ApplyResult>(`/projects/${projectId}/undo`, { method: "POST" });

export const getTraceability = (projectId: string, query: { entity?: string; id?: string } = {}) => {
  const params = new URLSearchParams();
  if (query.entity) params.set("entity", query.entity);
  if (query.id) params.set("id", query.id);
  const qs = params.toString();
  return apiCall<unknown>(`/projects/${projectId}/traceability${qs ? `?${qs}` : ""}`);
};

/** SVG của một diagram (cần token nên không dùng thẳng `<img src>`). */
export const fetchDiagramSvg = async (projectId: string, diagramId: string): Promise<string> => {
  const res = await authFetch(`/projects/${projectId}/diagrams/${diagramId}.svg`);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      "DIAGRAM_FETCH_FAILED",
      await readErrorMessage(res, `HTTP ${res.status}`)
    );
  }
  return res.text();
};
