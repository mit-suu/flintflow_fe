/**
 * Bộ nhớ đệm **Blob** của ảnh tài liệu (khoá `projectId:token`, token có hash nội dung nên ảnh vẽ lại ⇒ khoá khác).
 * Module lá — `auth.ts` và `orgs.ts` gọi `clearDocumentImageCache` khi đăng xuất / đổi tổ chức mà không tạo vòng import.
 * Chỉ giữ Blob, không giữ object URL: mỗi lần mount tự tạo URL riêng và tự thu hồi.
 */
const blobs = new Map<string, Blob>();
const inFlight = new Map<string, Promise<Blob>>();
/** Trần số ảnh giữ lại — tài liệu lớn có vài chục ảnh; vượt thì bỏ ảnh cũ nhất. */
export const MAX_CACHED_IMAGES = 200;

export const imageCacheKey = (projectId: string, token: string): string => `${projectId}:${token}`;

export const getCachedImage = (key: string): Blob | undefined => blobs.get(key);

export const putCachedImage = (key: string, blob: Blob): void => {
  blobs.delete(key);
  blobs.set(key, blob);
  while (blobs.size > MAX_CACHED_IMAGES) {
    const oldest = blobs.keys().next().value;
    if (oldest === undefined) break;
    blobs.delete(oldest);
  }
};

/** Một lượt tải cho mỗi khoá: nhiều khối cùng ảnh, hay mount lại giữa chừng, không tải trùng. */
export const shareInFlight = (key: string, start: () => Promise<Blob>): Promise<Blob> => {
  const running = inFlight.get(key);
  if (running) return running;
  const promise = start().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
};

/** Gọi khi đăng xuất / đổi tổ chức: ảnh của phiên cũ không được sót lại. */
export const clearDocumentImageCache = (): void => {
  blobs.clear();
  inFlight.clear();
};
