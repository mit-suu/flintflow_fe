import { describe, expect, it } from "vitest";
import { groupByRecency, recencyBucket } from "./group-by-recency";

const NOW = new Date(2026, 8, 19, 12, 0); // 19/09/2026 12:00 giờ máy

describe("recencyBucket", () => {
  it("chia theo ngày lịch", () => {
    expect(recencyBucket(new Date(2026, 8, 19, 0, 5).toISOString(), NOW)).toBe("today");
    expect(recencyBucket(new Date(2026, 8, 18, 23, 0).toISOString(), NOW)).toBe("week");
    expect(recencyBucket(new Date(2026, 8, 13).toISOString(), NOW)).toBe("week");
    expect(recencyBucket(new Date(2026, 8, 12).toISOString(), NOW)).toBe("month");
    expect(recencyBucket(new Date(2026, 7, 21).toISOString(), NOW)).toBe("month");
    expect(recencyBucket(new Date(2026, 7, 20).toISOString(), NOW)).toBe("older");
    expect(recencyBucket(null, NOW)).toBe("never");
  });
});

describe("groupByRecency", () => {
  it("mới nhất trước, bỏ vùng rỗng, không mốc thời gian xuống cuối", () => {
    const items = [
      { id: "old", at: new Date(2026, 5, 1).toISOString() },
      { id: "never", at: null },
      { id: "today-early", at: new Date(2026, 8, 19, 8).toISOString() },
      { id: "today-late", at: new Date(2026, 8, 19, 11).toISOString() },
    ];

    const groups = groupByRecency(items, (i) => i.at, NOW);

    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Hôm nay", ["today-late", "today-early"]],
      ["Cũ hơn", ["old"]],
      ["Chưa mở", ["never"]],
    ]);
  });
});
