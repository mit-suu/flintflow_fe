import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSpine, applyChanges } from "@/lib/api/spine";
import { answerStep, getProgress, listSteps, resumeProject, runStep, submitGate } from "@/lib/api/pipeline";
import type { StepEvent } from "@/types/pipeline";
import { mockTiming } from "./handlers";
import { mockServer } from "./server";
import { MOCK_PROJECT_ID, MOCK_SESSION_ID, resetMockState } from "./state";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => resetMockState());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

/** Chạy một step trên mock: tự trả lời câu hỏi nếu có, trả về danh sách sự kiện. */
const runToGate = async (stepId: string): Promise<StepEvent[]> => {
  const events: StepEvent[] = [];
  const base_version = await version();
  await runStep(P, stepId, { session_id: MOCK_SESSION_ID, base_version }, {
    onEvent: (event) => {
      events.push(event);
      if (event.type === "answer_needed") {
        void answerStep(P, stepId, {
          session_id: MOCK_SESSION_ID,
          answers: event.questions.map((q) => ({ question_id: q.id, answer: q.options?.[0] ?? "Có" })),
        });
      }
    },
  });
  return events;
};

describe("mock pipeline theo contract (DoD T12)", () => {
  it("bắt đầu ở S-3.1; GET /steps và /progress đúng hình", async () => {
    const steps = (await listSteps(P)).data!;
    expect(steps.current_step).toBe("S-3.1");
    expect(steps.steps.find((s) => s.id === "S-2.5")?.status).toBe("accepted");
    expect(steps.steps.find((s) => s.id === "S-3.1")).toMatchObject({ status: "pending", regenerate_limit: 3, calls_limit: 8 });

    const progress = (await getProgress(P)).data!;
    expect(progress.progress).toMatchObject({ current_step: "S-3.1", show_percent: false });
  });

  it("đi trọn S-3.1 → S-3.6 với gate từng step", async () => {
    for (const stepId of ["S-3.1", "S-3.2", "S-3.3", "S-3.4", "S-3.5", "S-3.6"]) {
      const events = await runToGate(stepId);
      const types = events.map((e) => e.type);
      expect(types[0], stepId).toBe("intake");
      expect(types[types.length - 1], stepId).toBe("gate_ready");
      if (stepId === "S-3.6") expect(types).toContain("render");

      const gate = await submitGate(P, stepId, { session_id: MOCK_SESSION_ID, action: "accept", base_version: await version() });
      expect(gate.data?.step.status, stepId).toBe("accepted");
    }
    const steps = (await listSteps(P)).data!;
    expect(steps.current_step).toBe("S-4.1");
    const spine = (await getSpine(P)).data!;
    expect(spine.actors.map((a) => a.id)).toEqual(["A01", "A02"]);
    expect(spine.use_cases.every((u) => u.description.length > 0)).toBe(true);
  });

  it("Regenerate lần 4 bị từ chối; Accept as-is đòi ghi chú và chỉ mở khi hết Regenerate", async () => {
    await runToGate("S-3.1");
    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", note: "ok", base_version: await version() })).rejects.toMatchObject({
      code: "STEP_NOT_RUNNABLE",
    });

    for (let i = 1; i <= 3; i++) {
      const res = await submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "regenerate", base_version: await version() });
      expect(res.data?.step.regenerate_used).toBe(i);
      const events = await runToGate("S-3.1");
      const gateReady = events.find((e) => e.type === "gate_ready");
      expect(gateReady && gateReady.type === "gate_ready" && gateReady.actions.includes("regenerate")).toBe(i < 3);
    }

    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "regenerate", base_version: await version() })).rejects.toMatchObject({
      code: "REGENERATE_LIMIT",
      status: 409,
    });
    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", base_version: await version() })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const asIs = await submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", note: "Chấp nhận mô tả hiện tại", base_version: await version() });
    expect(asIs.data?.step.status).toBe("accepted");
  });

  it("gate thiếu session_id ⇒ 400, session phụ ⇒ 403 NOT_PIPELINE_SESSION (contract-change 2026-09-15)", async () => {
    const base_version = await version();
    await expect(submitGate(P, "S-3.1", { session_id: "", action: "accept", base_version })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(submitGate(P, "S-3.1", { session_id: "other-session", action: "accept", base_version })).rejects.toMatchObject({
      code: "NOT_PIPELINE_SESSION",
      status: 403,
    });
  });

  it("POST /resume trả reverted_step + spine_version hiện tại", async () => {
    const res = await resumeProject(P);
    expect(res.data).toMatchObject({ reverted_step: null, spine_version: await version() });
    expect(res.data?.progress.progress.total).toBeGreaterThan(0);
  });

  it("base_version cũ ⇒ 409; POST /changes ops thuần tăng version", async () => {
    await expect(runStep(P, "S-3.1", { session_id: MOCK_SESSION_ID, base_version: 1 }, { onEvent: () => {} })).rejects.toThrow();

    const before = await version();
    const res = await applyChanges(P, { base_version: before, ops: [{ op: "set", path: "project.working_mode", value: "fast" }] });
    expect(res.data).toMatchObject({ spine_version: before + 1 });
    expect(res.data?.spine.project.working_mode).toBe("fast");
    await expect(applyChanges(P, { base_version: before, ops: [{ op: "set", path: "project.name", value: "X" }] })).rejects.toMatchObject({
      code: "SPINE_VERSION_CONFLICT",
    });
  });
});
