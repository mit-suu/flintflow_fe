import { describe, expect, it } from "vitest";
import { askReplyOf, initialRunnerState, stepRunnerReducer, type RunnerAction, type RunnerState } from "./useStepRunner";
import type { RunState, StepEvent } from "@/types/pipeline";

const apply = (actions: RunnerAction[], state: RunnerState = initialRunnerState) => actions.reduce(stepRunnerReducer, state);
const ev = (event: StepEvent): RunnerAction => ({ type: "event", event });

describe("lời AI của lượt hỏi không dính lời của bước khác", () => {
  it("chạy liền giai đoạn: lời của bước tự duyệt không nối vào lời hỏi của bước sau", () => {
    const state = apply([
      { type: "startPhase", phase: "S-4" },
      ev({ type: "phase_progress", step_id: "S-4.1", phase: "S-4", step_index: 1, step_total: 2, needs_user: false }),
      ev({ type: "elicit", step_id: "S-4.1", delta: "Mình đã đủ thông tin cho bước này." }),
      ev({ type: "gate_ready", step_id: "S-4.1", actions: ["accept"], regenerate_used: 0, calls_used: 2, auto: true }),
      ev({ type: "auto_accepted", step_id: "S-4.1", reason_vi: "Không có gì cần duyệt" }),
      ev({ type: "phase_progress", step_id: "S-4.2", phase: "S-4", step_index: 2, step_total: 2, needs_user: true }),
      ev({ type: "elicit", step_id: "S-4.2", delta: "Màn đặt lịch có cần xác nhận qua SMS không?" }),
      ev({ type: "answer_needed", step_id: "S-4.2", questions: [{ id: "Q_sms", text: "Có cần SMS không?" }] }),
    ]);
    expect(state.elicitText).toBe("Màn đặt lịch có cần xác nhận qua SMS không?");
    expect(state.questions.map((q) => q.id)).toEqual(["Q_sms"]);
  });

  it("sang bước mới thì câu hỏi cũ không còn treo", () => {
    const state = apply([
      { type: "startPhase", phase: "S-4" },
      ev({ type: "elicit", step_id: "S-4", delta: "Hỏi gộp." }),
      ev({ type: "answer_needed", step_id: "S-4", questions: [{ id: "Q1", text: "Ai?" }] }),
      ev({ type: "phase_progress", step_id: "S-4.1", phase: "S-4", step_index: 1, step_total: 2, needs_user: false }),
    ]);
    expect(state.elicitText).toBe("");
    expect(state.questions).toEqual([]);
  });
});

describe("khôi phục lượt chờ trả lời", () => {
  const run = (events: RunState["events"]): RunState => ({
    step_id: "S-3.1",
    run_id: "r1",
    status: "waiting_answer",
    stage: "ask",
    detail_vi: null,
    batch: null,
    started_at: new Date(1_000).toISOString(),
    last_event_at: new Date(2_000).toISOString(),
    alive: true,
    questions: [{ id: "Q_actor", text: "Ai dùng hệ thống?" }],
    gate_payload: null,
    events,
    error: null,
  });

  it("dựng lại lời AI từ `elicit` đứng ngay trước `answer_needed` cuối (lượt chat tự do mới nhất)", () => {
    const events: StepEvent[] = [
      { type: "elicit", step_id: "S-3.1", delta: "Lời hỏi đầu." },
      { type: "answer_needed", step_id: "S-3.1", questions: [] },
      { type: "answer_received", step_id: "S-3.1", count: 0 },
      { type: "elicit", step_id: "S-3.1", delta: "Lời AI sau tin chat." },
      { type: "answer_needed", step_id: "S-3.1", questions: [] },
    ];
    expect(askReplyOf(events)).toBe("Lời AI sau tin chat.");
    const restored = stepRunnerReducer(initialRunnerState, { type: "restored", state: run(events) });
    expect(restored).toMatchObject({ status: "needs_input", elicitText: "Lời AI sau tin chat." });
  });

  it("không có `answer_needed` ⇒ không đoán lời", () => {
    expect(askReplyOf([{ type: "elicit", step_id: "S-3.1", delta: "x" }])).toBe("");
  });
});

describe("gửi câu trả lời lỗi", () => {
  it("thẻ hỏi và lời AI quay lại để gửi lại, kèm lỗi", () => {
    const waiting = apply([
      { type: "start", stepId: "S-3.1" },
      ev({ type: "elicit", step_id: "S-3.1", delta: "Cho tôi hỏi." }),
      ev({ type: "answer_needed", step_id: "S-3.1", questions: [{ id: "Q1", text: "Ai?" }] }),
    ]);
    const failed = apply(
      [
        { type: "answered", count: 1 },
        { type: "answerFailed", questions: waiting.questions, elicitText: waiting.elicitText, code: "NETWORK_ERROR", message: "Mất mạng" },
      ],
      waiting
    );
    expect(failed).toMatchObject({ status: "needs_input", busy: false, elicitText: "Cho tôi hỏi.", error: { code: "NETWORK_ERROR" } });
    expect(failed.questions.map((q) => q.id)).toEqual(["Q1"]);
  });
});
