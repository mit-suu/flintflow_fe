/**
 * Ghép tài liệu, export Word và baseline — theo danh sách endpoint T08; chốt payload ở T16.
 */
import type { DocumentSource, RenderedDocument } from "@/types/document";
import type { Baseline } from "@/types/spine";
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

/** `meta.hint` của envelope lỗi (vd `"S-8.2"` cho `NO_WORKING_DRAFT`) — không phải trường bắt buộc. */
const readErrorHint = async (res: Response): Promise<string | undefined> => {
  try {
    const json: { meta?: { hint?: unknown } } = await res.json();
    return typeof json.meta?.hint === "string" ? json.meta.hint : undefined;
  } catch {
    return undefined;
  }
};

/** Dựng `ApiClientError` với đúng `code`/`message` từ envelope lỗi (không hard-code một mã chung). */
const readErrorAsApiClientError = async (res: Response, fallbackMessage: string): Promise<ApiClientError> => {
  const forMessage = res.clone();
  const forHint = res.clone();
  const [message, code, hint] = await Promise.all([
    readRawErrorMessage(forMessage, fallbackMessage),
    readErrorCode(res, "EXPORT_FAILED"),
    readErrorHint(forHint),
  ]);
  const finalMessage = hint && !message.includes(hint) ? `${message} (${hint})` : message;
  return new ApiClientError(res.status, code, finalMessage);
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

export interface WordExportResult {
  blob: Blob;
  /** Tên file gợi ý từ `Content-Disposition` của BE — `null` nếu header vắng/không phân tích được. */
  filename: string | null;
}

/**
 * Tải file `.docx`; lỗi (vd `NO_WORKING_DRAFT`) ném `ApiClientError` với đúng `code`/`message` đọc
 * từ envelope lỗi (không hard-code `EXPORT_FAILED` cho mọi lỗi). `baselineId` tuỳ chọn khi
 * `source === "baseline"` — chọn đúng bản baseline muốn xuất.
 */
export const downloadWordExport = async (
  projectId: string,
  source: DocumentSource = "draft",
  baselineId?: string
): Promise<WordExportResult> => {
  const query = `source=${source}${baselineId ? `&baseline_id=${baselineId}` : ""}`;
  const res = await authFetch(`/projects/${projectId}/export/word?${query}`);
  if (!res.ok) {
    throw await readErrorAsApiClientError(res, `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const filename = parseFilename(res.headers.get("Content-Disposition"));
  return { blob, filename };
};

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
