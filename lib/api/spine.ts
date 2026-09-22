/**
 * Spine, lịch sử thay đổi, hoà giải, undo, traceability — theo danh sách endpoint T08.
 * Chốt request/response theo `pipeline-contract.md` ở T12/T16.
 */
import type { ApplyResult, ChangeRequest, PreviewResult } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import type { TraceabilityQuery, TraceabilityResponse } from "@/types/flags";
import { ApiClientError, apiCall, authFetch, readRawErrorMessage } from "./client";

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
 * Áp lô op, tự rebase một lần khi Spine vừa đổi ở nơi khác (BUG-06).
 *
 * Lượt test gặp `SPINE_VERSION_CONFLICT` năm lần dù chỉ mở một tab: runner vừa ghi xong thì panel sửa vẫn
 * cầm `base_version` cũ. Đó không phải xung đột thật giữa hai người — đọc lại phiên bản mới rồi gửi lại
 * đúng lô đó là xong. Chỉ thử lại MỘT lần, và chỉ khi lô không đụng path nào vừa đổi; còn lại vẫn là 409
 * để người dùng tự quyết.
 */
export const applyChangesWithRebase = async (projectId: string, request: ChangeRequest): Promise<{ result: ApplyResult; rebased: boolean }> => {
  try {
    const res = await applyChanges(projectId, request);
    if (!res.data) throw new ApiClientError(500, "UNKNOWN_ERROR", "Không nhận được kết quả ghi");
    return { result: res.data, rebased: false };
  } catch (err) {
    if (!(err instanceof ApiClientError) || err.code !== "SPINE_VERSION_CONFLICT") throw err;

    const fresh = await getSpine(projectId);
    const version = fresh.data?.spine_version;
    if (version === undefined || version === request.base_version) throw err;

    // Lô đụng đúng path mà lượt ghi kia vừa đổi ⇒ không rebase âm thầm, để user xem lại.
    const touched = new Set((request.ops ?? []).map((op) => op.path));
    const changedElsewhere = await listChanges(projectId, { from: request.base_version });
    const collides = (changedElsewhere.data ?? []).some((change) => touched.has(change.path));
    if (collides) throw err;

    const retried = await applyChanges(projectId, { ...request, base_version: version });
    if (!retried.data) throw err;
    return { result: retried.data, rebased: true };
  }
};

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

/**
 * Vẽ lại một sơ đồ (BUG-17). Cờ đỏ `diagram_stale` trước đây không có nút nào để gỡ: user chỉ đọc được
 * "hình không còn khớp dữ liệu" rồi phải waive. `kind = "all"` vẽ lại cả bộ.
 */
export const renderDiagram = (projectId: string, kind: string, ownerId?: string | null) =>
  apiCall<{ rendered: string[]; spine_version: number }>(`/projects/${projectId}/diagrams/${kind}/render`, {
    method: "POST",
    body: JSON.stringify({ ...(ownerId ? { owner_id: ownerId } : {}), force: true }),
  });

/** SVG của một diagram (cần token nên không dùng thẳng `<img src>`). */
export const fetchDiagramSvg = async (projectId: string, diagramId: string): Promise<string> => {
  const res = await authFetch(`/projects/${projectId}/diagrams/${diagramId}.svg`);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      "DIAGRAM_FETCH_FAILED",
      await readRawErrorMessage(res, `HTTP ${res.status}`)
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
      await readRawErrorMessage(res, `HTTP ${res.status}`)
    );
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};
