/**
 * Import mode 1 (#2–#11 `docs/api/import-change-contract.md`). I-4 chạy nền: `startExtraction`/`resumeImport`
 * trả ngay `extracting`, tiến độ đọc bằng poll `getImport`.
 */
import type {
  ContinueFlow2Response,
  ExtractResponse,
  FieldsPatchRequest,
  FinalizeResponse,
  GapReport,
  GetImportResponse,
  ImportSourceResponse,
  ImportStateResponse,
  MappingPatchRequest,
  ReuploadDiff,
  LayoutPreview,
  ReviewRunResponse,
  ReviewSectionResponse,
  ReviewStopResponse,
  StepPlanPatchRequest,
  StepPlanResponse,
} from "@/types/import";
import type { RocRow } from "@/types/document";
import { ApiClientError, apiCall, authFetch } from "./client";
import { fetchFile } from "./files";

const base = (projectId: string) => `/projects/${projectId}`;

const docxForm = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return form;
};

/**
 * 422 `IMPORT_FILE_REJECTED` mang `meta.issues[]`; 422 `IMPORT_STAMP_FOREIGN_PROJECT` mang `meta.stamp`. Ý định với file (giữ
 * khung / bổ sung theo mẫu chuẩn) BE lấy từ dự án — chốt ở hộp Tạo dự án.
 */
export const uploadImport = (projectId: string, file: File) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import`, { method: "POST", body: docxForm(file) });

/**
 * Như `uploadImport` nhưng file lấy từ Google Drive (contract #46): `fileId` là file user chọn trong Google Picker. Thêm lỗi
 * Google (`GOOGLE_RECONNECT_REQUIRED`, `GOOGLE_FILE_UNSUPPORTED`, `GOOGLE_EXPORT_TOO_LARGE`…).
 */
export const importFromGoogleDocs = (projectId: string, fileId: string) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/google-docs`, { method: "POST", body: JSON.stringify({ fileId }) });

export const confirmLatest = (projectId: string, importId: string) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/confirm-latest`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

export const getImport = (projectId: string) => apiCall<GetImportResponse>(`${base(projectId)}/import`);

/** `notModified` = 304 (`etag` gửi lên còn khớp) ⇒ giữ bản đã có. */
export type ImportSourceResult = { notModified: true } | { notModified: false; etag: string | null; data: ImportSourceResponse };

/**
 * Chữ gốc của file theo mục cho màn đọc file. Tải một lần mỗi lần import (không đi theo poll); có `etag` cũ ⇒ gửi
 * `If-None-Match`, BE trả 304 không kèm nội dung.
 */
export const getImportSource = async (projectId: string, etag?: string | null): Promise<ImportSourceResult> => {
  const res = await authFetch(`${base(projectId)}/import/source`, etag ? { headers: { "If-None-Match": etag } } : {});
  if (res.status === 304) return { notModified: true };
  const json = (await res.json().catch(() => null)) as { data?: ImportSourceResponse | null; error?: { code?: string; message?: string }; meta?: Record<string, unknown> } | null;
  if (!res.ok || json?.error || !json?.data) {
    throw new ApiClientError(res.status, json?.error?.code ?? "UNKNOWN_ERROR", json?.error?.message ?? `HTTP ${res.status}`, json?.meta);
  }
  return { notModified: false, etag: res.headers.get("ETag"), data: json.data };
};

export const patchMapping = (projectId: string, body: MappingPatchRequest) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/mapping`, { method: "PATCH", body: JSON.stringify(body) });

/** FLF-412: cả tập mục chọn Bỏ chữ ở màn đọc khung (trước Bắt đầu) — BE tính lại bản sơ bộ, đọc lại `GET /import`. */
export const setDropText = (projectId: string, importId: string, keys: string[]) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/drop-text`, { method: "PATCH", body: JSON.stringify({ import_id: importId, keys }) });

/** FLF-456: chọn ngôn ngữ tài liệu khi file chỉ còn khung (trước Bắt đầu) — BE tính lại credit, đọc lại `GET /import`. */
export const setSkeletonLanguage = (projectId: string, importId: string, language: "en" | "vi") =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/document-language`, { method: "PATCH", body: JSON.stringify({ import_id: importId, language }) });

/**
 * Nút "Bắt đầu" (FLF-343): BE chạy một mạch I-4 ⇒ baseline 0.1 ⇒ kiểm tra. `confirmLatest` = câu "đây là bản mới nhất"
 * (bắt buộc khi file chưa xác nhận — thiếu ⇒ 409 `IMPORT_NEEDS_LATEST_CONFIRM`).
 */
export const startExtraction = (projectId: string, importId: string, confirmLatest?: boolean) =>
  apiCall<ExtractResponse>(`${base(projectId)}/import/extract`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId, ...(confirmLatest ? { confirm_latest: true } : {}) }),
  });

export const patchFields = (projectId: string, body: FieldsPatchRequest) =>
  apiCall<ImportStateResponse>(`${base(projectId)}/import/fields`, { method: "PATCH", body: JSON.stringify(body) });

/** `recordOfChanges` (FLF-252): dòng Record of Changes đã xem/sửa ở wizard; bỏ trống ⇒ BE đọc lại từ file. */
export const finalizeImport = (projectId: string, importId: string, baseVersion: number, recordOfChanges?: RocRow[], opts: { complete?: boolean } = {}) =>
  apiCall<FinalizeResponse>(`${base(projectId)}/import/finalize`, {
    method: "POST",
    // FLF-336: `complete: true` từ màn "Kết quả đọc file" (import `incomplete`)
    body: JSON.stringify({ import_id: importId, base_version: baseVersion, ...(recordOfChanges ? { record_of_changes: recordOfChanges } : {}), ...(opts.complete ? { complete: true } : {}) }),
  });

/** FLF-278 trên FLF-336: chế độ 3 ở `incomplete` ⇒ viết phần còn thiếu với FlintFlow (Luồng 2) thay vì Hoàn thiện. */
export const continueImportFlow2 = (projectId: string, importId: string, baseVersion: number) =>
  apiCall<ContinueFlow2Response>(`${base(projectId)}/import/continue`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId, base_version: baseVersion }),
  });

export const resumeImport = (projectId: string, importId: string) =>
  apiCall<ExtractResponse>(`${base(projectId)}/import/resume`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

/** Dừng lượt đọc nội dung đang chạy (#10b): BE dừng trước lượt AI kế tiếp, không trừ thêm credit. Tiếp tục bằng `resumeImport`. */
export const pauseImport = (projectId: string, importId: string) =>
  apiCall<ExtractResponse>(`${base(projectId)}/import/pause`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

/**
 * FLF-453 (business-flow §3.1.2 "Rà soát phần có sẵn"): người dùng xác nhận credit ở `reviewing` ⇒ chạy AI rà các mục
 * Code đã chọn rồi sang Luồng 2. Lượt AI lỗi / hết credit ⇒ trả `{ import }` đang `paused`, vẫn `reviewing` — gọi lại để
 * tiếp tục (lượt đã trừ credit không chạy lại).
 */
export const runImportReview = (projectId: string, importId: string) =>
  apiCall<ReviewRunResponse>(`${base(projectId)}/import/review/run`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

/** FLF-453: người dùng đã xác nhận credit riêng của một mục chỉ được Code kiểm ⇒ AI rà đúng mục đó (vẫn `reviewing`). */
export const runImportSectionReview = (projectId: string, importId: string, sectionId: string) =>
  apiCall<ReviewSectionResponse>(`${base(projectId)}/import/review/section`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId, section_id: sectionId, confirm: true }),
  });

/** Bấm Dừng khi vòng rà soát đang chạy — giữ tiến độ, lượt chưa trừ credit không chạy. */
export const stopImportReview = (projectId: string, importId: string) =>
  apiCall<ReviewStopResponse>(`${base(projectId)}/import/review/stop`, {
    method: "POST",
    body: JSON.stringify({ import_id: importId }),
  });

/** FLF-461 bước 2.9a: bố cục mới của chế độ 4 trước khi áp vào bản in. */
export const getLayoutPreview = (projectId: string) => apiCall<LayoutPreview>(`${base(projectId)}/import/layout-preview`);

/** FLF-461 bước 2.9a: xác nhận bố cục mới ⇒ bản in từ giờ áp bố cục đó. */
export const confirmLayoutPreview = (projectId: string) =>
  apiCall<LayoutPreview>(`${base(projectId)}/import/layout-preview/confirm`, { method: "POST" });

export const getGapReport = (projectId: string) => apiCall<GapReport>(`${base(projectId)}/gap-report`);

/** Tải lần đầu ⇒ BE chuyển import sang `delivered`. */
export const downloadGapReport = (projectId: string) => fetchFile(`${base(projectId)}/gap-report?format=docx`);

/** Không tạo version — chỉ trả khác biệt so với version mới nhất. */
export const reuploadDocument = (projectId: string, file: File) =>
  apiCall<ReuploadDiff>(`${base(projectId)}/reupload`, { method: "POST", body: docxForm(file) });

/** #32 (FLF-182): step nào chạy / ẩn / thiếu theo template của file upload. */
export const getStepPlan = (projectId: string) => apiCall<StepPlanResponse>(`${base(projectId)}/step-plan`);

/** #33: bật step ẩn / tắt step đã bật. 409 `CORE_STEP_REQUIRED` khi tắt bước luôn chạy / step đã có dữ liệu; 404 `STEP_NOT_IN_PLAN`. */
export const patchStepPlan = (projectId: string, body: StepPlanPatchRequest) =>
  apiCall<StepPlanResponse>(`${base(projectId)}/step-plan`, { method: "PATCH", body: JSON.stringify(body) });
