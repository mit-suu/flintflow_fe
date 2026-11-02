/**
 * Dựng tài liệu, export Word / PDF và baseline — theo danh sách endpoint T08; chốt payload ở T16.
 */
import type { DocumentSource, RenderedDocument } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import type { Baseline, BaselineSubmission } from "@/types/spine";
import { ApiClientError, apiCall, authFetch, readRawErrorMessage } from "./client";

/**
 * Đọc `error.code` từ envelope lỗi — cùng mục đích với `readRawErrorMessage` (client.ts) nhưng đặt
 * cục bộ ở đây vì `client.ts` bị đóng băng ngoài vùng sở hữu T16. Dùng `res.clone()` ở nơi gọi để
 * không tranh đọc body với `readRawErrorMessage`/`readErrorHint`.
 */
const readErrorCode = async (res: Response, fallback: string): Promise<string> => {
  try {
    const json: { error?: { code?: unknown } } = await res.json();
    return typeof json.error?.code === "string" ? json.error.code : fallback;
  } catch {
    return fallback;
  }
};

/** `meta.hint` của envelope lỗi — gợi ý thêm BE đính kèm tuỳ mã lỗi, không phải trường bắt buộc. */
const readErrorHint = async (res: Response): Promise<string | undefined> => {
  try {
    const json: { meta?: { hint?: unknown } } = await res.json();
    return typeof json.meta?.hint === "string" ? json.meta.hint : undefined;
  } catch {
    return undefined;
  }
};

/** `meta` của envelope lỗi (vd `TRANSLATION_INCOMPLETE { locale, missing, total }` — FLF-334 B). */
const readErrorMeta = async (res: Response): Promise<Record<string, unknown> | undefined> => {
  try {
    const json: { meta?: unknown } = await res.json();
    return json.meta && typeof json.meta === "object" ? (json.meta as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/** Dựng `ApiClientError` với đúng `code`/`message`/`meta` từ envelope lỗi (không hard-code một mã chung). */
const readErrorAsApiClientError = async (res: Response, fallbackMessage: string): Promise<ApiClientError> => {
  const forMessage = res.clone();
  const forHint = res.clone();
  const forMeta = res.clone();
  const [message, code, hint, meta] = await Promise.all([
    readRawErrorMessage(forMessage, fallbackMessage),
    readErrorCode(res, "EXPORT_FAILED"),
    readErrorHint(forHint),
    readErrorMeta(forMeta),
  ]);
  const finalMessage = hint && !message.includes(hint) ? `${message} (${hint})` : message;
  return new ApiClientError(res.status, code, finalMessage, meta);
};

/** `Content-Disposition: attachment; filename="..."` hoặc `filename*=UTF-8''...` — ưu tiên tên từ BE. */
const parseFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plainMatch ? plainMatch[1].trim() : null;
};

/**
 * `POST /projects/:id/assemble` — trả kết quả dựng (`assembleResponseSchema`), không phải tài liệu.
 * Từ FLF-264 không còn chỗ nào trong UI gọi: `GET /document` tự dựng bản còn thiếu. Giữ vì endpoint vẫn
 * thuộc hợp đồng (pipeline gọi ở S-8.2).
 */
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

export interface WordExportResult {
  blob: Blob;
  /** Tên file gợi ý từ `Content-Disposition` của BE — `null` nếu header vắng/không phân tích được. */
  filename: string | null;
}

/** File PDF (FLF-316) tải cùng cách với Word — chỉ khác định dạng. */
export type PdfExportResult = WordExportResult;

/** Định dạng file xuất: `word` (#18) hoặc `pdf` (#34, chính file Word chuyển sang PDF ở BE). */
export type ExportFormat = "word" | "pdf";

const downloadExport = async (
  format: ExportFormat,
  projectId: string,
  source: DocumentSource,
  baselineId?: string,
  lang?: DocumentLanguage
): Promise<WordExportResult> => {
  const query = `source=${source}${baselineId ? `&baseline_id=${baselineId}` : ""}${lang ? `&lang=${lang}` : ""}`;
  const res = await authFetch(`/projects/${projectId}/export/${format}?${query}`);
  if (!res.ok) {
    throw await readErrorAsApiClientError(res, `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const filename = parseFilename(res.headers.get("Content-Disposition"));
  return { blob, filename };
};

/**
 * Tải file `.docx`; lỗi (vd `NO_WORKING_DRAFT`) ném `ApiClientError` với đúng `code`/`message` đọc
 * từ envelope lỗi (không hard-code `EXPORT_FAILED` cho mọi lỗi). `baselineId` tuỳ chọn khi
 * `source === "baseline"` — chọn đúng bản baseline muốn xuất. `lang` (FLF-334 B) tuỳ chọn: bỏ trống ⇒ ngôn ngữ tài liệu;
 * khác ⇒ file theo ngôn ngữ đó, còn mục chưa dịch ⇒ `409 TRANSLATION_INCOMPLETE` (`meta { locale, missing, total }`),
 * chỗ chưa hỗ trợ ⇒ `409 DOCUMENT_LANGUAGE_UNAVAILABLE`.
 */
export const downloadWordExport = (projectId: string, source: DocumentSource = "draft", baselineId?: string, lang?: DocumentLanguage) =>
  downloadExport("word", projectId, source, baselineId, lang);

/**
 * Tải file `.pdf` (FLF-316) — cùng query, lỗi và header với `downloadWordExport`. Thêm một lỗi riêng:
 * `503 PDF_EXPORT_UNAVAILABLE` khi bộ chuyển PDF của BE không sẵn sàng; tải Word vẫn được.
 */
export const downloadPdfExport = (
  projectId: string,
  source: DocumentSource = "draft",
  baselineId?: string,
  lang?: DocumentLanguage
): Promise<PdfExportResult> => downloadExport("pdf", projectId, source, baselineId, lang);

export const listBaselines = (projectId: string) =>
  apiCall<Baseline[]>(`/projects/${projectId}/baselines`);

/**
 * XREQ T19→T16: `baselineRequestSchema` (đóng băng) bắt buộc `base_version` — gửi thiếu thì BE trả
 * `400 VALIDATION_ERROR`. `baseVersion` là `spine_version` đang xem, giống mọi endpoint ghi khác:
 * lệch thì BE trả `409 SPINE_VERSION_CONFLICT` và client tải lại Spine rồi ký lại.
 *
 * Lỗi riêng cần xử lý ở nơi gọi: `422 BASELINE_BLOCKED` kèm `meta.flags[]` — còn cờ đỏ chưa waive.
 */
export const createBaseline = (projectId: string, baseVersion: number) =>
  apiCall<Baseline>(`/projects/${projectId}/baseline`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });

/**
 * UC-45 — Analyst gửi Lead duyệt. Chưa khoá baseline, chỉ đặt `spine.baseline_submission` sang `pending`.
 * Lỗi riêng cần xử ở nơi gọi: `422 BASELINE_BLOCKED` (`meta.flags[]`), `422 REJECTION_COMMENTS_OPEN`
 * (`meta.comment_ids[]` — lượt từ chối trước còn góp ý chưa xử lý), `409 BASELINE_ALREADY_SUBMITTED`.
 */
export const submitBaseline = (projectId: string, baseVersion: number) =>
  apiCall<BaselineSubmission>(`/projects/${projectId}/baseline/submit`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });

/**
 * UC-46 luồng thay thế — Lead từ chối. `business-flow.md §3.5` đòi **cả** lý do **và** comment ghim, nên
 * `commentIds` là mảng không rỗng ngay ở kiểu: từ chối bằng mỗi câu lý do thì Analyst không biết sửa chỗ
 * nào và không bước nào được mở lại.
 */
export const rejectBaseline = (projectId: string, baseVersion: number, reason: string, commentIds: readonly [string, ...string[]]) =>
  apiCall<BaselineSubmission>(`/projects/${projectId}/baseline/reject`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion, reason, comment_ids: commentIds }),
  });
