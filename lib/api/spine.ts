/**
 * Spine, lịch sử thay đổi, hoà giải, undo, traceability — theo danh sách endpoint T08.
 * Chốt request/response theo `pipeline-contract.md` ở T12/T16.
 */
import type { ApplyResult, ChangeRequest, PreviewResult } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import type { TraceabilityQuery, TraceabilityResponse } from "@/types/flags";
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
  apiCall<PreviewResult>(`/projects/${projectId}/changes/preview`, {
    method: "POST",
    body: JSON.stringify(request),
  });

export const applyChanges = (projectId: string, request: ChangeRequest) =>
  apiCall<ApplyResult>(`/projects/${projectId}/changes`, {
    method: "POST",
    body: JSON.stringify(request),
  });

/**
 * Hoà giải một lượt (T17). Lượt đầu chỉ `base_version` ⇒ trả `PreviewResult` gộp; gửi kèm
 * `preview_id` đã user xác nhận ⇒ trả `ApplyResult` đã ghi. `base_version` bắt buộc theo
 * `reconcileRequestSchema` — thiếu nó BE trả 400 chắc chắn, nên không cho gọi thiếu tham số.
 */
export const reconcile = (projectId: string, request: { base_version: number; preview_id?: string }) =>
  apiCall<PreviewResult | ApplyResult>(`/projects/${projectId}/reconcile`, {
    method: "POST",
    body: JSON.stringify(request),
  });

/** `base_version` bắt buộc theo `undoRequestSchema` — thiếu nó BE trả 400 chắc chắn. */
export const undoLastChange = (projectId: string, request: { base_version: number }) =>
  apiCall<ApplyResult>(`/projects/${projectId}/undo`, {
    method: "POST",
    body: JSON.stringify(request),
  });

export const getTraceability = (projectId: string, query: TraceabilityQuery) => {
  const params = new URLSearchParams({ entity: query.entity, id: query.id });
  return apiCall<TraceabilityResponse>(`/projects/${projectId}/traceability?${params.toString()}`);
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

/**
 * PNG của một diagram, dùng khi `RenderedDocument` trả tham chiếu `diagram-ref:<id>` thay vì
 * base64 thật (cache nội bộ BE — `rendered-document.model.ts`). Trả object URL để gán `<img src>`.
 */
export const fetchDiagramPng = async (projectId: string, diagramId: string): Promise<string> => {
  const res = await authFetch(`/projects/${projectId}/diagrams/${diagramId}.png`);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      "DIAGRAM_FETCH_FAILED",
      await readErrorMessage(res, `HTTP ${res.status}`)
    );
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};
