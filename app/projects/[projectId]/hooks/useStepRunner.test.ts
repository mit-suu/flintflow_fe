import { describe, expect, it } from "vitest";
import { initialRunnerState, stepRunnerReducer, type RunnerAction, type RunnerState } from "./useStepRunner";

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
});
