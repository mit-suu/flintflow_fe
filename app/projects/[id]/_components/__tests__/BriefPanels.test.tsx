import { describe, expect, it } from "vitest";
import { buildDecisionOps, needsSingleReview } from "../AssumptionSweepPanel";
import { PARKED_SECTION, buildDropOp, buildRetargetOp } from "../AddendumTriagePanel";
import { groupByTarget } from "../BriefSummaryCard";
import type { Addendum } from "@/types/spine";

const AT = "2026-09-16T00:00:00.000Z";

const addendum = (id: string, target: string, topic = id): Addendum => ({
  id,
  topic,
  content: `nội dung ${id}`,
  content_en: `content ${id}`,
  target_section: target,
  captured_at: AT,
});

describe("AssumptionSweepPanel — duyệt lẻ hay duyệt lô", () => {
  it("giả định chạm ngưỡng NFR hoặc bất biến phải duyệt lẻ", () => {
    expect(needsSingleReview({ path: "nfrs[id=N08].threshold" })).toBe(true);
    expect(needsSingleReview({ path: "project.stakes" })).toBe(true);
    expect(needsSingleReview({ path: "screens[id=S01].detail_status" })).toBe(true);
    expect(needsSingleReview({ path: "functions[id=FN01].priority" })).toBe(true);
  });

  it("giả định thường thì duyệt lô được", () => {
    expect(needsSingleReview({ path: "project.goals" })).toBe(false);
    expect(needsSingleReview({ path: "project.vision" })).toBe(false);
    expect(needsSingleReview({ path: "addendum[id=AD01].content" })).toBe(false);
  });

  it("xác nhận ⇒ set status + confirmed_at; từ chối ⇒ confirmed_at null", () => {
    expect(buildDecisionOps("AS01", "confirmed", AT)).toEqual([
      { op: "set", path: "assumptions[id=AS01].status", value: "confirmed", reason: "B-2.1 Assumption Sweep" },
      { op: "set", path: "assumptions[id=AS01].confirmed_at", value: AT, reason: "B-2.1 Assumption Sweep" },
    ]);
    expect(buildDecisionOps("AS02", "rejected", AT)[1].value).toBeNull();
  });
});

describe("AddendumTriagePanel — để dành là đổi đích, không phải xoá", () => {
  it("để dành ⇒ set target_section = fixed:5.4 (S-7.4 nhặt sau)", () => {
    expect(buildRetargetOp("AD08", PARKED_SECTION)).toEqual({
      op: "set",
      path: "addendum[id=AD08].target_section",
      value: "fixed:5.4",
      reason: "B-2.2 để dành sang phụ lục",
    });
  });

  it("đổi đích thường dùng lý do khác để §I đọc ra được ý định", () => {
    expect(buildRetargetOp("AD03", "fixed:2.1").reason).toBe("B-2.2 đổi đích");
  });

  it("bỏ hẳn là op remove — chỉ dùng khi nội dung sai", () => {
    expect(buildDropOp("AD09")).toEqual({
      op: "remove",
      path: "addendum[id=AD09]",
      reason: "B-2.2 bỏ: nội dung không đúng",
    });
  });
});

describe("BriefSummaryCard — nhóm ghi chú theo mục tài liệu", () => {
  it("gom theo target_section và sắp xếp ổn định", () => {
    const groups = groupByTarget([
      addendum("AD03", "fixed:2.1"),
      addendum("AD01", "fixed:1"),
      addendum("AD02", "fixed:1"),
    ]);

    expect(groups.map(([target, entries]) => [target, entries.map((e) => e.id)])).toEqual([
      ["fixed:1", ["AD01", "AD02"]],
      ["fixed:2.1", ["AD03"]],
    ]);
  });

  it("không có ghi chú ⇒ không nhóm nào", () => {
    expect(groupByTarget([])).toEqual([]);
  });
});
