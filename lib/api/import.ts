/**
 * Import mode 1 (#2–#11 `docs/api/import-change-contract.md`). I-4 chạy nền: `startExtraction`/`resumeImport`
 * trả ngay `extracting`, tiến độ đọc bằng poll `getImport`.
 */
import type {
  ExtractResponse,
  FieldsPatchRequest,
  FinalizeResponse,
  GapReport,
  GetImportResponse,
  ImportStateResponse,
  MappingPatchRequest,
  ReuploadDiff,
} from "@/types/import";
import { apiCall } from "./client";
import { fetchFile } from "./files";

const base = (projectId: string) => `/projects/${projectId}`;

const docxForm = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return form;
};

/** 422 `IMPORT_FILE_REJECTED` mang `meta.issues[]`; 422 `IMPORT_STAMP_FOREIGN_PROJECT` mang `meta.stamp`. */
export const uploadImport = (projectId: string, file: File) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import`, { method: "POST", body: docxForm(file) });

export const confirmLatest = (projectId: string, importId: string) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/confirm-latest`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

export const getImport = (projectId: string) => apiCall<GetImportResponse>(`${base(projectId)}/import`);

export const patchMapping = (projectId: string, body: MappingPatchRequest) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/mapping`, { method: "PATCH", body: JSON.stringify(body) });

export const startExtraction = (projectId: string, importId: string) =>
  apiCall<ExtractResponse>(`${base(projectId)}/import/extract`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

export const patchFields = (projectId: string, body: FieldsPatchRequest) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/fields`, { method: "PATCH", body: JSON.stringify(body) });

export const finalizeImport = (projectId: string, importId: string, baseVersion: number) =>
  apiCall<FinalizeResponse>(`${base(projectId)}/import/finalize`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId, base_version: baseVersion }),
  });

export const resumeImport = (projectId: string, importId: string) =>
  apiCall<ExtractResponse>(`${base(projectId)}/import/resume`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

export const getGapReport = (projectId: string) => apiCall<GapReport>(`${base(projectId)}/gap-report`);

/** Tải lần đầu ⇒ BE chuyển import sang `delivered`. */
export const downloadGapReport = (projectId: string) => fetchFile(`${base(projectId)}/gap-report?format=docx`);

/** Không tạo version — chỉ trả khác biệt so với version mới nhất. */
export const reuploadDocument = (projectId: string, file: File) =>
  apiCall<ReuploadDiff>(`${base(projectId)}/reupload`, { method: "POST", body: docxForm(file) });
