/**
 * Việc không ghi DB: ghi chú "Giữ", màn "Đặc tả chi tiết vòng này" (đã xem), việc "Để sau" và nhóm cờ đã tách nhớ trong `localStorage`
 * theo dự án. Storage bị chặn / đầy ⇒ nuốt lỗi, hook vẫn giữ tập trong state nên chỉ mất khi tải lại trang.
 */
/** `split` (chế độ 1, FLF-445): nhóm cờ người dùng tách ra, mỗi phần tử là danh sách id cờ (`splitKey`). */
export type QueueMemoryKind = "seen" | "later" | "split";

const storageKey = (kind: QueueMemoryKind, projectId: string) => `ff:resolve-queue:${kind}:${projectId}`;

export const readQueueMemory = (kind: QueueMemoryKind, projectId: string): Set<string> => {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(storageKey(kind, projectId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
};

/** Tập rỗng ⇒ xoá hẳn key (tự dọn), không để `[]` nằm lại. */
export const writeQueueMemory = (kind: QueueMemoryKind, projectId: string, keys: ReadonlySet<string>): void => {
  try {
    if (typeof window === "undefined") return;
    if (keys.size === 0) window.localStorage.removeItem(storageKey(kind, projectId));
    else window.localStorage.setItem(storageKey(kind, projectId), JSON.stringify([...keys]));
  } catch {
    // Chặn storage / hết dung lượng: chỉ nhớ trong phiên
  }
};

/** Giữ lại đúng các key còn trong hàng; không đổi gì thì trả lại chính tập vào (khỏi render lại). */
export const pruneKeys = (keys: ReadonlySet<string>, alive: ReadonlySet<string>): ReadonlySet<string> => {
  const kept = [...keys].filter((key) => alive.has(key));
  return kept.length === keys.size ? keys : new Set(kept);
};
