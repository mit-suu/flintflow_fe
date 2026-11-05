import { ApiClientError, authFetch } from "./client";
import { getCachedImage, imageCacheKey, putCachedImage, shareInFlight } from "./document-image-cache";

export { clearDocumentImageCache } from "./document-image-cache";

/** Mã lỗi BE khi ảnh đã được vẽ lại sau khi tài liệu dựng: tải lại tài liệu để lấy tham chiếu mới. */
export const IMAGE_CHANGED = "IMAGE_CHANGED";

const IMAGE_REF_PATTERN = /^image-ref:(diagram|media):([^:@]+)(?::([a-z]{2}))?@([0-9a-f]{16})$/;

export interface ImageRef {
  kind: "diagram" | "media";
  id: string;
  locale?: string;
  hash: string;
}

/** Phân tích chuỗi `png` dạng `image-ref:<kind>:<id>[:<locale>]@<hash>`; không đúng dạng ⇒ `null` (base64 hay dạng cũ). */
export const parseImageRef = (png: string): ImageRef | null => {
  const match = IMAGE_REF_PATTERN.exec(png);
  if (!match) return null;
  return { kind: match[1] as ImageRef["kind"], id: match[2], ...(match[3] ? { locale: match[3] } : {}), hash: match[4] };
};

const errorOf = async (res: Response): Promise<ApiClientError> => {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string }; meta?: Record<string, unknown> };
    return new ApiClientError(res.status, body.error?.code ?? "IMAGE_FETCH_FAILED", body.error?.message ?? `HTTP ${res.status}`, body.meta);
  } catch {
    return new ApiClientError(res.status, "IMAGE_FETCH_FAILED", `HTTP ${res.status}`);
  }
};

/**
 * Ảnh của tài liệu theo tham chiếu (`GET /document/image?ref=`) — bytes thô, đi qua `authFetch` (Bearer + refresh).
 * Blob được nhớ theo `projectId:token`: token có hash nội dung nên cùng khoá ⇒ cùng ảnh, vẽ lại ⇒ khoá mới.
 * Lỗi `409 IMAGE_CHANGED` / `404 IMAGE_NOT_FOUND` ném `ApiClientError` mang đúng mã đó.
 */
export const fetchDocumentImage = (projectId: string, token: string): Promise<Blob> => {
  const key = imageCacheKey(projectId, token);
  const cached = getCachedImage(key);
  if (cached) return Promise.resolve(cached);
  return shareInFlight(key, async () => {
    const res = await authFetch(`/projects/${projectId}/document/image?ref=${encodeURIComponent(token)}`);
    if (!res.ok) throw await errorOf(res);
    const blob = await res.blob();
    putCachedImage(key, blob);
    return blob;
  });
};
