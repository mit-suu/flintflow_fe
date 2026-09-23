import { describe, expect, it } from "vitest";
import { initialRunnerState, isTerminalEvent, stepRunnerReducer, type RunnerAction, type RunnerState } from "./useStepRunner";

const apply = (actions: RunnerAction[], state: RunnerState = initialRunnerState) => actions.reduce(stepRunnerReducer, state);

describe("stepRunnerReducer", () => {
  it("intake → answer_needed → answered → draft → gate_ready", () => {
    const needsInput = apply([
      { type: "start", stepId: "S-3.1" },
      { type: "event", event: { type: "intake", step_id: "S-3.1", phase: "S-3", empty_fields: ["actors"] } },
      { type: "event", event: { type: "elicit", step_id: "S-3.1", delta: "Cho mình " } },
      { type: "event", event: { type: "elicit", step_id: "S-3.1", delta: "hỏi" } },
      { type: "event", event: { type: "answer_needed", step_id: "S-3.1", questions: [{ id: "q1", text: "Ai?" }] } },
    ]);
    expect(needsInput).toMatchObject({ status: "needs_input", busy: false, elicitText: "Cho mình hỏi", stepId: "S-3.1" });
    expect(needsInput.questions).toHaveLength(1);

    const ready = apply(
      [
        { type: "answered" },
        { type: "event", event: { type: "draft", step_id: "S-3.1", attempt: 1 } },
        { type: "event", event: { type: "ops_applied", step_id: "S-3.1", txn: "t", spine_version: 9, changes: [] } },
        { type: "event", event: { type: "gate_ready", step_id: "S-3.1", actions: ["accept", "regenerate"], regenerate_used: 1, calls_used: 3 } },
      ],
      needsInput
    );
    expect(ready).toMatchObject({ status: "gate_ready", busy: false, questions: [], gate: { actions: ["accept", "regenerate"], regenerate_used: 1 } });
    // intake, elicit ×2, answer_needed, draft, ops_applied, gate_ready
    expect(ready.events).toHaveLength(7);
  });

  it("sự kiện error và lỗi HTTP chuyển sang error; reset về idle", () => {
    const errored = apply([
      { type: "start", stepId: "S-3.1" },
      { type: "event", event: { type: "error", step_id: "S-3.1", code: "CALL_LIMIT", message: "Hết lượt", retryable: false } },
    ]);
    expect(errored).toMatchObject({ status: "error", error: { code: "CALL_LIMIT" }, busy: false });

    const failed = apply([{ type: "start", stepId: "S-3.2" }, { type: "failed", code: "SPINE_VERSION_CONFLICT", message: "409" }]);
    expect(failed.error?.code).toBe("SPINE_VERSION_CONFLICT");
    expect(stepRunnerReducer(failed, { type: "reset" })).toEqual(initialRunnerState);
  });

  it("stage + heartbeat: biết đang làm gì và lượt còn sống, heartbeat không vào nhật ký", () => {
    const drafting = apply([
      { type: "start", stepId: "S-5.4@S03" },
      { type: "event", event: { type: "stage", step_id: "S-5.4@S03", stage: "draft", label_vi: "AI đang soạn nội dung", detail_vi: "lô 1/2", batch: { i: 1, n: 2 } }, at: 1_000 },
      { type: "event", event: { type: "heartbeat", step_id: "S-5.4@S03", stage: "draft", elapsed_ms: 5_000 }, at: 6_000 },
    ]);
    expect(drafting).toMatchObject({ status: "drafting", stage: "draft", detail: "lô 1/2", batch: { i: 1, n: 2 }, lastEventAt: 6_000 });
    expect(drafting.events.filter((e) => e.type === "heartbeat")).toHaveLength(0);
  });

  it("BUG-32: gửi trả lời là đổi trạng thái ngay, không chờ BE", () => {
    const answered = apply([
      { type: "start", stepId: "S-3.1" },
      { type: "event", event: { type: "answer_needed", step_id: "S-3.1", questions: [{ id: "q1", text: "Ai?" }] } },
      { type: "answered", count: 3 },
    ]);
    expect(answered).toMatchObject({ status: "drafting", busy: true, questions: [] });
    expect(answered.detail).toContain("Đã nhận 3 câu trả lời");
  });

  it("draft_retry nói bằng lời thường; stage mới xoá thông báo thử lại", () => {
    const retrying = apply([
      { type: "start", stepId: "S-3.1" },
      { type: "event", event: { type: "draft_retry", step_id: "S-3.1", attempt: 2, max: 3, reason_vi: "kết quả thiếu trường" } },
    ]);
    expect(retrying.retry).toMatchObject({ attempt: 2, max: 3, reason: "kết quả thiếu trường" });
    const next = stepRunnerReducer(retrying, { type: "event", event: { type: "stage", step_id: "S-3.1", stage: "check", label_vi: "Kiểm tra" } });
    expect(next.retry).toBeNull();
  });

  it("gate_ready mang theo tóm tắt, cờ và giả định mới (Lớp 4)", () => {
    const ready = apply([
      { type: "start", stepId: "S-4.3" },
      {
        type: "event",
        event: {
          type: "ops_applied",
          step_id: "S-4.3",
          txn: "t",
          spine_version: 9,
          changes: [],
          summary: [{ kind: "add", collection: "permissions", id: "P010", title_vi: "Admin tạo trên Manage Staff" }],
        },
      },
      {
        type: "event",
        event: {
          type: "gate_ready",
          step_id: "S-4.3",
          actions: ["accept"],
          regenerate_used: 0,
          calls_used: 2,
          summary: [{ kind: "add", collection: "permissions", id: "P010", title_vi: "Admin tạo trên Manage Staff" }],
          new_assumptions: [{ id: "AS12", text: "Lễ tân không được xoá lịch hẹn" }],
          flags: { red: 2, yellow: 5, red_delta: -1, yellow_delta: 0 },
          duration_ms: 58_000,
          credits_used: 4,
        },
      },
    ]);
    expect(ready.summary).toHaveLength(1);
    expect(ready.gate?.payload?.new_assumptions?.[0].id).toBe("AS12");
    expect(ready.gate?.payload?.flags?.red_delta).toBe(-1);
  });

  it("BUG-07: khôi phục sau reload — đang hỏi thì dựng lại form, ở gate thì dựng lại thẻ duyệt", () => {
    const base = {
      step_id: "S-3.1",
      run_id: "r1",
      stage: "ask" as const,
      detail_vi: "Chờ bạn trả lời 2 câu",
      batch: null,
      started_at: new Date(1_000).toISOString(),
      last_event_at: new Date(2_000).toISOString(),
      alive: true,
      gate_payload: null,
      events: [],
      error: null,
    };
    const asking = stepRunnerReducer(initialRunnerState, {
      type: "restored",
      state: { ...base, status: "waiting_answer", questions: [{ id: "q1", text: "Ai?" }, { id: "q2", text: "Khi nào?" }] },
    });
    expect(asking).toMatchObject({ status: "needs_input", stepId: "S-3.1" });
    expect(asking.questions).toHaveLength(2);

    const atGate = stepRunnerReducer(initialRunnerState, {
      type: "restored",
      state: {
        ...base,
        status: "gate",
        stage: "gate",
        questions: null,
        gate_payload: { type: "gate_ready", step_id: "S-3.1", actions: ["accept"], regenerate_used: 0, calls_used: 2 },
      },
    });
    expect(atGate).toMatchObject({ status: "gate_ready" });
    expect(atGate.gate?.actions).toEqual(["accept"]);

    const dead = stepRunnerReducer(initialRunnerState, { type: "restored", state: { ...base, status: "running", alive: false, questions: null } });
    expect(dead.status).toBe("interrupted");
    expect(dead.busy).toBe(false);
  });

  it("chỉ gate_ready và error là sự kiện kết thúc luồng", () => {
    expect(isTerminalEvent({ type: "gate_ready", step_id: "S-3.1", actions: ["accept"], regenerate_used: 0, calls_used: 1 })).toBe(true);
    expect(isTerminalEvent({ type: "error", step_id: "S-3.1", code: "CALL_LIMIT", message: "x", retryable: false })).toBe(true);
    expect(isTerminalEvent({ type: "answer_needed", step_id: "S-3.1", questions: [] })).toBe(false);
    expect(isTerminalEvent({ type: "flags", step_id: "S-3.1", red_open: 0, yellow_open: 0 })).toBe(false);
  });
});
