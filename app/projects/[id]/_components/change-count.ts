/**
 * FLF-431 (FLF-413 #13): số thay đổi **nội dung** của một lượt áp. Lượt "Xác nhận không đổi" của hoà giải chỉ ghi mốc duyệt
 * (`steps[…].last_seq` / `accepted_at`) — trước đây toast đếm cả các op đó nên bản xem trước ghi "Không có thay đổi nào"
 * mà toast lại báo "Đã áp dụng 44 thay đổi". Gốc hệ thống giống `SYSTEM_ONLY_ROOTS` của BE (`undo.service.ts`).
 */
const SYSTEM_ROOTS: ReadonlySet<string> = new Set(["diagrams", "baselines", "flags", "sections", "steps", "progress"]);

const rootOf = (path: string): string => /^[a-z_]+/.exec(path)?.[0] ?? path;

export const contentChangeCount = (changes: readonly { path: string }[]): number => changes.filter((c) => !SYSTEM_ROOTS.has(rootOf(c.path))).length;
