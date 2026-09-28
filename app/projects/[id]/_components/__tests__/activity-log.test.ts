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

  it("mỗi việc một dòng kèm mục vừa ghi; không số đếm nội bộ, không thời lượng; một bước lẻ không có dòng tiêu đề", () => {
    const lines = activityLines(events, false);
    expect(lines.map((l) => l.text)).toEqual(["Soạn nội dung", "Ghi +2 actor ~1 use case", "Phát hiện 1 lỗi cần sửa"]);
    expect(lines[1].details).toEqual(["Thêm actor: A01", "Thêm actor: A02", "Cập nhật use case: UC1"]);
    expect(lines[2].status).toBe("failed");
  });

  it("đọc tin/câu trả lời chỉ hiện lúc đang đọc, xong thì biến mất; câu hỏi và cổng duyệt không thành dòng", () => {
    const reading: LoggedEvent[] = [
      { type: "answer_needed", step_id: "B-0.1", questions: [] },
      { type: "answer_received", step_id: "B-0.1", count: 0 },
    ];
    expect(activityLines(reading, true).map((l) => [l.text, l.status])).toEqual([["Đọc tin nhắn của bạn", "running"]]);
    expect(activityLines(reading, false)).toEqual([]);
    expect(activityLines([...reading, { type: "draft", step_id: "B-0.1", attempt: 1 }], true).map((l) => l.text)).toEqual(["Soạn nội dung"]);
  });

  it("field dự án viết bằng lời thường; bước tự duyệt không thành dòng; nhiều bước thì có tiêu đề từng bước", () => {
    const lines = activityLines(
      [
        { type: "ops_applied", step_id: "B-0.1", txn: "t", spine_version: 2, changes: [], summary: [{ kind: "update", collection: "project", id: null, title_vi: "system_name: Internal Hub" }] },
        { type: "auto_accepted", step_id: "B-0.2", reason_vi: "Đã chốt ở bước trước — không cần hỏi lại" },
        { type: "draft", step_id: "B-1.1", attempt: 1 },
      ],
      false
    );
    expect(lines.map((l) => [l.kind, l.text])).toEqual([
      ["step", expect.stringContaining("B-0.1")],
      ["task", "Ghi ~1 thông tin dự án"],
      ["step", expect.stringContaining("B-1.1")],
      ["task", "Soạn nội dung"],
    ]);
    expect(lines[1].details).toEqual(["Tên hệ thống: Internal Hub"]);
  });

  it("đang chạy ⇒ dòng cuối là việc đang làm", () => {
    const lines = activityLines(events.slice(0, 3), true);
    expect(lines.at(-1)).toMatchObject({ text: "Soạn nội dung", status: "running" });
  });

  it("summaryCounts gộp theo loại và nhóm", () => {
    expect(summaryCounts([{ kind: "remove", collection: "screens", id: "S1", title_vi: "S1" }])).toBe("−1 màn hình");
  });
});
