/**
 * Fast path Brief (FLF-234): bước im không lộ thẻ cổng, cổng cuối giai đoạn sống qua reload, và một 409 ở cổng của bước
 * đã được server chốt không làm gãy lượt đang chạy.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiClientError } from "@/lib/api/client";
import { initialRunnerState, isTerminalEvent, stepRunnerReducer, useStepRunner } from "./useStepRunner";
import type { GateReadyEvent, PhaseGateEvent, RunState, StepEvent } from "@/types/pipeline";

const runPhase = vi.fn();
const submitGate = vi.fn();
const getRunState = vi.fn();
const getActiveRunState = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  submitGate: (...args: unknown[]) => submitGate(...args),
  runStep: vi.fn(),
  answerStep: vi.fn(),
  getRunState: (...args: unknown[]) => getRunState(...args),
  getActiveRunState: (...args: unknown[]) => getActiveRunState(...args),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

vi.mock("@/lib/api/spine", () => ({ getSpine: vi.fn().mockResolvedValue({ data: null }) }));

const gateAt = (stepId: string, extra: Partial<GateReadyEvent> = {}): GateReadyEvent => ({
  type: "gate_ready",
  step_id: stepId,
  actions: ["accept"],
  regenerate_used: 0,
  calls_used: 1,
  spine_version: 30,
  ...extra,
});

const phaseGate: PhaseGateEvent = {
  type: "phase_gate",
  step_id: "B-1.6",
  phase: "B-1",
  reason_vi: "Cuối giai đoạn",
  summary: [],
  new_assumptions: [
    { id: "AS2", text: "app + SMS", text_vi: "Tôi đoán có app và SMS" },
    { id: "AS3", text: "inpatient later" },
    { id: "AS4", text: "office hours" },
  ],
  steps: [],
  message_vi: "Tôi đoán có app và SMS. Nội trú để sau. Giờ hành chính. Đúng rồi chứ?",
};

const runState = (patch: Partial<RunState>): RunState => ({
  step_id: "B-1.6",
  run_id: "r1",
  status: "gate",
  stage: "gate",
  detail_vi: null,
  batch: null,
  started_at: new Date(1_000).toISOString(),
  last_event_at: new Date(2_000).toISOString(),
  alive: true,
  questions: null,
  gate_payload: gateAt("B-1.6", { new_assumptions: [{ id: "AS4", text: "office hours" }] }),
  phase_gate: phaseGate,
  events: [],
  error: null,
  ...patch,
});

const setup = () => renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 12, onSpineChanged: vi.fn() }));

beforeEach(() => {
  runPhase.mockReset();
  submitGate.mockReset();
  getRunState.mockReset().mockResolvedValue({ data: null });
  getActiveRunState.mockReset().mockResolvedValue({ data: null });
});

describe("gate_ready.auto — bước im", () => {
  it("không dựng thẻ cổng; chuỗi vẫn bận, sự kiện vào nhật ký", () => {
    const started = stepRunnerReducer(initialRunnerState, { type: "startPhase", phase: "B-1" });
    const state = stepRunnerReducer(started, { type: "event", event: gateAt("B-1.2", { auto: true }) });
    expect(state.gate).toBeNull();
    expect(state.status).not.toBe("gate_ready");
    expect(state.busy).toBe(true);
    expect(state.events.map((e: StepEvent) => e.type)).toContain("gate_ready");
  });

  it("gate_ready không auto vẫn là cổng thật; auto không đóng luồng SSE", () => {
    const state = stepRunnerReducer(initialRunnerState, { type: "event", event: gateAt("B-1.1") });
    expect(state.status).toBe("gate_ready");
    expect(state.gate).not.toBeNull();
    expect(isTerminalEvent(gateAt("B-1.1"))).toBe(true);
    expect(isTerminalEvent(gateAt("B-1.1", { auto: true }))).toBe(false);
  });

  it("chuỗi chỉ có bước im rồi hết giai đoạn ⇒ về rảnh, không coi là dừng ở cổng", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: StepEvent) => void }) => {
      h.onEvent(gateAt("B-1.1", { auto: true }));
      h.onEvent({ type: "auto_accepted", step_id: "B-1.1", reason_vi: "im" });
    });
    const { result } = setup();
    await act(async () => result.current.runWholePhase("B-1"));
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.gate).toBeNull();
  });
});

describe("cổng chốt cuối giai đoạn sống qua reload", () => {
  it("restored: phaseGate lấy từ run-state, giả định của cổng là cả giai đoạn (chip xác nhận đúng các id đó)", () => {
    const state = stepRunnerReducer(initialRunnerState, { type: "restored", state: runState({}) });
    expect(state.status).toBe("gate_ready");
    expect(state.phaseGate?.new_assumptions.map((a) => a.id)).toEqual(["AS2", "AS3", "AS4"]);
    expect(state.phaseGate?.message_vi).toContain("app và SMS");
  });

  it("bước lẻ / project cũ (không có phase_gate) ⇒ phaseGate null, cổng dựng từ gate_payload như trước", () => {
    const legacy: Partial<RunState> = runState({});
    delete legacy.phase_gate;
    const state = stepRunnerReducer(initialRunnerState, { type: "restored", state: legacy as RunState });
    expect(state.phaseGate).toBeNull();
    expect(state.gate?.payload?.new_assumptions?.map((a) => a.id)).toEqual(["AS4"]);
  });

  it("restore() sau reload dựng lại phaseGate", async () => {
    getActiveRunState.mockResolvedValue({ data: runState({}) });
    const { result } = setup();
    await act(async () => {
      await result.current.restore();
    });
    expect(result.current.state.phaseGate?.new_assumptions).toHaveLength(3);
  });
});

describe("409 ở cổng của bước server đã tự chốt", () => {
  it("bám theo lượt đang chạy bằng run-state, không mở chuỗi mới", async () => {
    const { result } = setup();
    // thẻ cổng còn trên màn hình ở B-1.2 (dựng lại từ run-state)
    getActiveRunState.mockResolvedValueOnce({ data: runState({ step_id: "B-1.2", gate_payload: gateAt("B-1.2"), phase_gate: null }) });
    await act(async () => {
      await result.current.restore();
    });
    expect(result.current.state.status).toBe("gate_ready");

    // server đã sang B-1.3
    getActiveRunState.mockResolvedValue({ data: runState({ step_id: "B-1.3", status: "running", stage: "draft", gate_payload: null, phase_gate: null }) });
    submitGate.mockRejectedValue(new ApiClientError(409, "STEP_NOT_RUNNABLE", "Bước B-1.2 đang chạy ở lượt trước (bắt đầu 11:51) — huỷ lượt đó rồi chạy lại"));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.gate("accept");
    });
    expect(outcome).toBe("ok");
    expect(runPhase).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.state).toMatchObject({ stepId: "B-1.3", busy: true, source: "restored" }));
    expect(result.current.state.error).toBeNull();
  });
});
