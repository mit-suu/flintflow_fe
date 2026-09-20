/** Vùng thời gian của tab "Dự án" (theo lịch ngày địa phương). */
export type RecencyBucket = "today" | "week" | "month" | "older" | "never";

const ORDER: readonly RecencyBucket[] = ["today", "week", "month", "older", "never"];
const DAY = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const recencyBucket = (iso: string | null | undefined, now: Date = new Date()): RecencyBucket => {
  if (!iso) return "never";
  const time = new Date(iso).getTime();
  const today = startOfDay(now);
  if (time >= today) return "today";
  if (time >= today - 6 * DAY) return "week";
  if (time >= today - 29 * DAY) return "month";
  return "older";
};

/**
 * Sắp xếp mới nhất trước theo `dateOf` rồi chia vùng Hôm nay · 7 ngày · 30 ngày · Cũ hơn (· Chưa mở khi không có
 * mốc). Vùng rỗng bị bỏ.
 */
export function groupByRecency<T>(
  items: readonly T[],
  dateOf: (item: T) => string | null | undefined,
  now: Date = new Date()
): { bucket: RecencyBucket; items: T[] }[] {
  const sorted = [...items].sort((a, b) => {
    const ta = dateOf(a) ? new Date(dateOf(a) as string).getTime() : -Infinity;
    const tb = dateOf(b) ? new Date(dateOf(b) as string).getTime() : -Infinity;
    return tb - ta;
  });
  const groups = new Map<RecencyBucket, T[]>();
  for (const item of sorted) {
    const bucket = recencyBucket(dateOf(item), now);
    groups.set(bucket, [...(groups.get(bucket) ?? []), item]);
  }
  return ORDER.filter((b) => groups.has(b)).map((bucket) => ({ bucket, items: groups.get(bucket)! }));
}
