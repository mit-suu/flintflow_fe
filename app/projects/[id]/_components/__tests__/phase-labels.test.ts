import { describe, expect, it } from "vitest";
import { STEP_REGISTRY } from "@/lib/constants/step-registry";
import { PHASE_NAV_LABELS, workspaceStepLabel } from "../phase-labels";

const INTERNAL = /addendum|giả định|brief|giả thuyết/i;

describe("workspaceStepLabel", () => {
  it("đè nhãn registry có chữ nội bộ bằng lời thường", () => {
    expect(workspaceStepLabel("B-2.2")).toBe("Sắp xếp ghi chú");
    expect(workspaceStepLabel("B-1.6")).toBe("Rủi ro & câu hỏi còn mở");
    expect(workspaceStepLabel("B-2.1")).toBe("Xem lại chỗ tôi đoán");
  });
  it("bước khác lấy nhãn registry; id lạ giữ nguyên", () => {
    expect(workspaceStepLabel("B-0.1")).toBe("Kể hết ý tưởng");
    expect(workspaceStepLabel("X-9")).toBe("X-9");
  });
  it("không bước Brief / phân tích / rà soát nào còn chữ nội bộ", () => {
    const ids = STEP_REGISTRY.filter((s) => s.phase.startsWith("B-") || s.phase === "S-1" || s.phase === "S-9").map((s) => s.id);
    expect(ids.filter((id) => INTERNAL.test(workspaceStepLabel(id)))).toEqual([]);
  });
  it("tên giai đoạn ở rail không có chữ Brief", () => {
    expect(Object.values(PHASE_NAV_LABELS).filter((l) => INTERNAL.test(l))).toEqual([]);
  });
});
