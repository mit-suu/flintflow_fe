/**
 * Ghép tài liệu, export Word và baseline — theo danh sách endpoint T08; chốt payload ở T16.
 */
import type { DocumentSource, RenderedDocument } from "@/types/document";
import type { Baseline } from "@/types/spine";
import { ApiClientError, apiCall, authFetch, readErrorMessage } from "./client";

/** `POST /projects/:id/assemble` — trả kết quả ghép (`assembleResponseSchema`), không phải tài liệu. */
export interface AssembleResult {
  spine_version: number;
  sections: number;
  generated_at: string;
}

export const assembleDocument = (projectId: string, baseVersion: number) =>
  apiCall<AssembleResult>(`/projects/${projectId}/assemble`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });

export const getDocument = (projectId: string, source: DocumentSource = "draft", baselineId?: string) =>
  apiCall<RenderedDocument>(
    `/projects/${projectId}/document?source=${source}${baselineId ? `&baseline_id=${baselineId}` : ""}`
  );

/** Tải file `.docx`; lỗi (vd `NO_WORKING_DRAFT`) ném `ApiClientError` với thông điệp từ BE. */
export const downloadWordExport = async (
  projectId: string,
  source: DocumentSource = "draft"
): Promise<Blob> => {
  const res = await authFetch(`/projects/${projectId}/export/word?source=${source}`);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      "EXPORT_FAILED",
      await readErrorMessage(res, `HTTP ${res.status}`)
    );
  }
  return res.blob();
};

export const listBaselines = (projectId: string) =>
  apiCall<Baseline[]>(`/projects/${projectId}/baselines`);

export const createBaseline = (projectId: string) =>
  apiCall<Baseline>(`/projects/${projectId}/baseline`, { method: "POST" });
