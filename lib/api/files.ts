/**
 * Tải file (không bọc envelope) từ BE — dùng chung cho gap report `.docx` và bản tải của từng version (mode 1).
 * Lỗi đọc `code`/`message`/`meta` từ envelope lỗi như `apiCall`.
 */
import { ApiClientError, authFetch } from "./client";

export interface DownloadedFile {
  blob: Blob;
  /** Tên từ `Content-Disposition`; `null` khi header vắng. */
  filename: string | null;
}

/** `attachment; filename="..."` hoặc `filename*=UTF-8''...` — ưu tiên dạng UTF-8. */
export const parseContentDispositionFilename = (header: string | null): string | null => {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
};

export const fetchFile = async (path: string): Promise<DownloadedFile> => {
  const res = await authFetch(path);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
      meta?: Record<string, unknown>;
    } | null;
    throw new ApiClientError(res.status, json?.error?.code ?? "DOWNLOAD_FAILED", json?.error?.message ?? `HTTP ${res.status}`, json?.meta);
  }
  return { blob: await res.blob(), filename: parseContentDispositionFilename(res.headers.get("Content-Disposition")) };
};

/** Ghim thẻ `<a download>` vào DOM trước khi click — Safari/Firefox bỏ qua click trên thẻ rời DOM. */
export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
