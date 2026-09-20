import { describe, expect, it } from "vitest";
import { fieldChanges, showValue, valueSummary } from "./value-diff";

const json = (v: Record<string, unknown>) => JSON.stringify(v, null, 2);

describe("value-diff — thay đổi phần tử Spine theo field (FLF-186)", () => {
  it("chỉ liệt kê field khác nhau; field thêm/bỏ hiện '—' ở phía thiếu; mảng/đối tượng in JSON gọn", () => {
    const before = json({ id: "NFR-01", statement: "Respond within 2 seconds.", threshold: "2 s", tags: ["perf"] });
    const after = json({ id: "NFR-01", statement: "Respond within 1 second.", threshold: "1 s", tags: ["perf", "sla"], metric: "p95" });
    expect(fieldChanges(before, after)).toEqual([
      { field: "statement", before: "Respond within 2 seconds.", after: "Respond within 1 second." },
      { field: "threshold", before: "2 s", after: "1 s" },
      { field: "tags", before: '["perf"]', after: '["perf","sla"]' },
      { field: "metric", before: "—", after: "p95" },
    ]);
    expect(fieldChanges(before, before)).toEqual([]);
  });

  it("không phải JSON đối tượng ⇒ một dòng 'giá trị' cho cả khối; giống nhau ⇒ rỗng", () => {
    expect(fieldChanges("a", "b")).toEqual([{ field: "giá trị", before: "a", after: "b" }]);
    expect(fieldChanges("a", "a")).toEqual([]);
  });

  it("tóm tắt phần tử theo name / statement / term…; showValue", () => {
    expect(valueSummary(json({ id: "A01", name: "Student" }))).toBe("Student");
    expect(valueSummary(json({ id: "BR-01", statement: "Passwords ≥ 8 characters." }))).toBe("Passwords ≥ 8 characters.");
    expect(valueSummary(json({ id: "X" }))).toBe("");
    expect(valueSummary("không phải json")).toBe("không phải json");
    expect(showValue(null)).toBe("—");
    expect(showValue(3)).toBe("3");
  });
});
