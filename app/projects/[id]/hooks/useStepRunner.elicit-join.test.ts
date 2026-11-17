import { describe, expect, it } from "vitest";
import { initialRunnerState, stepRunnerReducer, type RunnerAction, type RunnerState } from "./useStepRunner";

const apply = (actions: RunnerAction[], state: RunnerState = initialRunnerState) => actions.reduce(stepRunnerReducer, state);
const elicit = (step_id: string, delta: string): RunnerAction => ({ type: "event", event: { type: "elicit", step_id, delta } });

describe("P13 - lời AI của các bước liên tiếp không dính chữ khi chạy cả giai đoạn", () => {
  it("delta của cùng một lời nối thẳng (không chèn khoảng trắng)", () => {
    const state = apply([{ type: "startPhase", phase: "S-1" }, elicit("S-1.2", "Có gì cần sửa thì cứ "), elicit("S-1.2", "nói tôi nhé.")]);
    expect(state.elicitText).toBe("Có gì cần sửa thì cứ nói tôi nhé.");
  });

  it("lời của bước kế tiếp mở đoạn mới", () => {
    const state = apply([
      { type: "startPhase", phase: "S-1" },
      elicit("S-1.2", "Có gì cần sửa thì cứ nói tôi nhé."),
      elicit("S-1.3", "Hiện chưa có mục tiêu đo được."),
    ]);
    expect(state.elicitText).toBe("Có gì cần sửa thì cứ nói tôi nhé.\n\nHiện chưa có mục tiêu đo được.");
  });

  it("lời mới sau một sự kiện kết thúc lời trước (draft, auto_accepted, phase_progress…) cũng mở đoạn mới", () => {
    const state = apply([
      { type: "startPhase", phase: "S-2" },
      elicit("S-2.2", "Bạn muốn đổi gì thì nói lại nhé. "),
      { type: "event", event: { type: "draft", step_id: "S-2.2", attempt: 1 } },
      elicit("S-2.2", " Phạm vi đã đủ."),
    ]);
    expect(state.elicitText).toBe("Bạn muốn đổi gì thì nói lại nhé.\n\nPhạm vi đã đủ.");
  });

  it("sự kiện stage giữa hai delta không cắt lời", () => {
    const state = apply([
      { type: "startPhase", phase: "S-1" },
      elicit("S-1.1", "Tôi đã "),
      { type: "event", event: { type: "stage", step_id: "S-1.1", stage: "ask", label_vi: "AI đang hỏi" } },
      elicit("S-1.1", "ghi lại."),
    ]);
    expect(state.elicitText).toBe("Tôi đã ghi lại.");
  });
});
