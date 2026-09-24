import { describe, expect, it } from "vitest";
import type { Flag } from "@/types/flags";
import { actionOf, flagGroupTitle, groupByAction, issueCounts, readableMessage } from "../flag-rules";

const flag = (over: Partial<Flag> & Pick<Flag, "id" | "rule_id">): Flag => ({
  level: "red",
  section_id: "fixed:1",
  target_id: null,
  message: "",
  remediation_step: "S-1.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
  ...over,
});

describe("flag-rules", () => {
  it("gom theo việc phải làm; luật lạ rơi về 'fix' và không có tên nhóm", () => {
    expect(actionOf("unconfirmed_assumption")).toBe("confirm");
    expect(actionOf("section_empty")).toBe("run_step");
    expect(actionOf("diagram_stale")).toBe("redraw");
    expect(actionOf("luat_moi_cua_be")).toBe("fix");
    expect(flagGroupTitle("luat_moi_cua_be")).toBeNull();

    const groups = groupByAction([
      flag({ id: "A", rule_id: "section_empty" }),
      flag({ id: "B", rule_id: "unconfirmed_assumption" }),
      flag({ id: "C", rule_id: "nfr_missing_number" }),
    ]);
    // Thứ tự: xác nhận → sửa → … → chạy tiếp cuối cùng
    expect(groups.map((g) => g.action)).toEqual(["confirm", "fix", "run_step"]);
  });

  it("đếm: mục 'sẽ điền ở bước sau' không tính là vấn đề; cờ đã bỏ qua/đã đóng không tính", () => {
    const counts = issueCounts(
      [
        flag({ id: "1", rule_id: "nfr_missing_number" }),
        flag({ id: "2", rule_id: "section_empty", section_id: "fixed:3.1.2" }),
        flag({ id: "3", rule_id: "array_empty", section_id: "fixed:3.1.2" }),
        flag({ id: "4", rule_id: "orphan_actor", level: "yellow" }),
        flag({ id: "5", rule_id: "nfr_missing_number", waived_by_user: true }),
        flag({ id: "6", rule_id: "dead_reference", resolved_at: "2026-09-23T00:00:00Z" }),
      ],
      2
    );
    expect(counts).toEqual({ blocking: 1 + 2, suggestions: 1, later: 1 });
  });

  it("thay mã mục nội bộ trong câu của BE bằng tên mục; không có tên thì giữ nguyên", () => {
    expect(readableMessage("Section bắt buộc fixed:3.1.2 chưa có dữ liệu", "fixed:3.1.2", "§3.1.2 Screen Descriptions")).toBe(
      "Section bắt buộc §3.1.2 Screen Descriptions chưa có dữ liệu"
    );
    expect(readableMessage("Thiếu fixed:4.1", "fixed:4.1", undefined)).toBe("Thiếu fixed:4.1");
  });
});
