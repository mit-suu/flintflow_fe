import { describe, expect, it } from "vitest";
import { mode1NextLabel, nextStepLabel } from "./ProjectCard";
import type { Project } from "@/types/project";
import { tStep } from "@/lib/i18n";
import type { ProgressResponse } from "@/types/pipeline";

const progress = (over: Partial<ProgressResponse["progress"]> = {}, readiness: Partial<ProgressResponse["readiness"]> = {}): ProgressResponse => ({
  readiness: { accepted_pct: 0, awaiting_reaccept: 0, red_open: 0, stale: 0, ...readiness },
  progress: { done: 0, total: 51, current_phase: null, current_step: null, show_percent: false, ...over },
  sections: [],
});

describe("nextStepLabel — việc tiếp theo lấy từ step registry", () => {
  it("đang tải ⇒ nói đang tải, không hiện nhãn sai", () => {
    expect(nextStepLabel(undefined)).toBe("Đang tải…");
  });

  it("project chưa có Spine ⇒ mời bắt đầu, không hiện mã step thô", () => {
    expect(nextStepLabel(null)).toContain("Chưa bắt đầu");
  });

  it("có Spine nhưng chưa chạy step nào ⇒ vẫn là chưa bắt đầu", () => {
    expect(nextStepLabel(progress())).toContain("Chưa bắt đầu");
  });

  it("đang ở một step ⇒ đúng nhãn của registry, không phải bảng cứng cũ", () => {
    expect(nextStepLabel(progress({ current_step: "S-3.1" }))).toBe(tStep("S-3.1", "vi"));
  });

  it("step vòng S-5 hiện kèm khoá màn", () => {
    expect(nextStepLabel(progress({ current_step: "S-5.4@S07" }))).toContain("S07");
  });

  it("đổi ngôn ngữ thì nhãn đổi theo", () => {
    const vi = nextStepLabel(progress({ current_step: "S-3.1" }), "vi");
    const en = nextStepLabel(progress({ current_step: "S-3.1" }), "en");
    expect(vi).not.toBe(en);
  });
});

describe("mode1NextLabel — thẻ dự án upload SRS (UC-14, UC-19)", () => {
  const project = (import_state: Project["import_state"]): Project => ({
    _id: "p1",
    name: "Lumen",
    status: "active",
    mode: "import",
    import_state,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  });

  it("chưa upload ⇒ mời tải SRS lên", () => {
    expect(mode1NextLabel(project(null))).toContain("Chưa tải SRS lên");
  });

  it("đang import ⇒ trạng thái import", () => {
    expect(mode1NextLabel(project("mapping_review"))).toBe("Nhập SRS: Chờ xác nhận mapping");
  });

  it("đã có baseline ⇒ số CR đang mở, không có thì trạng thái", () => {
    expect(mode1NextLabel(project("change_requested"), 2)).toBe("2 change request đang mở");
    expect(mode1NextLabel(project("gap_review"), 0)).toBe("Chờ xem gap report");
  });
});
