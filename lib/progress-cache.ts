import type { ProgressResponse } from "@/types/pipeline";

/**
 * Tiến độ gần nhất của từng dự án trong tab này — thẻ dự án ở trang chủ hiện ngay số đã biết khi quay lại (không chớp "Đang tải…"
 * + thanh xám cho mọi thẻ), rồi cập nhật từng thẻ khi `GET /progress` trả về. Mọi lần đọc tiến độ (workspace, trang xem, trang chủ)
 * đều ghi vào đây qua `getProgress`, nên làm việc trong workspace xong quay ra là thẻ đã đúng. Chỉ là bản nhớ tạm để hiển thị —
 * số thật vẫn do BE tính, trang chủ luôn đọc lại.
 */
interface ProgressCache {
  progress: Map<string, ProgressResponse | null>;
  openCrs: Map<string, number>;
}
// Trên `globalThis`: trang chủ và trang dự án có thể ở hai chunk khác nhau — một bản cho cả tab
const cache: ProgressCache = ((globalThis as { __ffProgressCache?: ProgressCache }).__ffProgressCache ??= { progress: new Map(), openCrs: new Map() });

export const rememberProgress = (projectId: string, progress: ProgressResponse | null): void => {
  cache.progress.set(projectId, progress);
};

export const cachedProgress = (): Record<string, ProgressResponse | null> => Object.fromEntries(cache.progress);

export const rememberOpenCrs = (projectId: string, count: number): void => {
  cache.openCrs.set(projectId, count);
};

export const cachedOpenCrs = (): Record<string, number> => Object.fromEntries(cache.openCrs);
