import { describe, expect, it } from "vitest";
import { activityLines, summaryCounts, type LoggedEvent } from "../activity-log";

const T0 = Date.parse("2026-09-28T01:00:00.000Z");

describe("activityLines (FLF-221)", () => {
  const events: LoggedEvent[] = [
    { type: "intake", step_id: "B-1.2", phase: "B-1", empty_fields: ["project.goals"], at: T0 },
    { type: "stage", step_id: "B-1.2", stage: "draft", label_vi: "AI đang soạn nội dung", at: T0 + 500 },
    { type: "draft", step_id: "B-1.2", attempt: 1, at: T0 + 1000 },
    {
      type: "ops_applied",
      step_id: "B-1.2",
      txn: "t1",
      spine_version: 3,
      changes: [],
      summary: [
        { kind: "add", collection: "actors", id: "A01", title_vi: "A01" },
        { kind: "add", collection: "actors", id: "A02", title_vi: "A02" },
        { kind: "update", collection: "use_cases", id: "UC1", title_vi: "UC1" },
      ],
      at: new Date(T0 + 13_000).toISOString(),
    },
    { type: "flags", step_id: "B-1.2", red_open: 1, yellow_open: 0, red_delta: 1, at: T0 + 14_000 },
  ];

  it("mỗi việc một dòng, có dòng tiêu đề bước; việc xong có thời lượng; stage không thành dòng", () => {
    const lines = activityLines(events, false);
    expect(lines.map((l) => l.text)).toEqual([
      expect.stringContaining("B-1.2"),
      "Đọc dữ liệu · còn thiếu 1 mục",
      "AI soạn nội dung",
      "Đã ghi +2 actor ~1 use case",
      "Kiểm tra: 1 cờ đỏ mới",
    ]);
    expect(lines[1]).toMatchObject({ status: "done", duration: "00:01" });
    expect(lines[2]).toMatchObject({ status: "done", duration: "00:12" });
  });

  it("đang chạy ⇒ dòng cuối là việc đang làm, chưa có thời lượng", () => {
    const lines = activityLines(events.slice(0, 3), true);
    expect(lines.at(-1)).toMatchObject({ text: "AI soạn nội dung", status: "running", duration: null });
  });

  it("summaryCounts gộp theo loại và nhóm", () => {
    expect(summaryCounts([{ kind: "remove", collection: "screens", id: "S1", title_vi: "S1" }])).toBe("−1 màn hình");
  });
});
