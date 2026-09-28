/**
 * Trả lời sau reload / rớt kết nối (FLF-222): không còn luồng SSE, BE chạy tiếp lượt ở nền và FE theo dõi bằng
 * `GET /run-state` tới gate hoặc lỗi. Phỏng vấn đầu giai đoạn thì BE chỉ ghi câu trả lời, FE chạy lại giai đoạn.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { initialRunnerState, isPhaseUnit, stepRunnerReducer, useStepRunner } from "./useStepRunner";
import type { RunState } from "@/types/pipeline";

const runPhase = vi.fn();
const runStep = vi.fn();
const answerStep = vi.fn();
const getRunState = vi.fn();
const getActiveRunState = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  answerStep: (...args: unknown[]) => answerStep(...args),
  getRunState: (...args: unknown[]) => getRunState(...args),
  getActiveRunState: (...args: unknown[]) => getActiveRunState(...args),
  submitGate: vi.fn(),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

const run = (patch: Partial<RunState>): RunState => ({
  step_id: "S-3.1",
  run_id: "r1",
  status: "waiting_answer",
  stage: "ask",
  detail_vi: "Chờ bạn trả lời 1 câu",
  batch: null,
  started_at: new Date(1_000).toISOString(),
  last_event_at: new Date(2_000).toISOString(),
  alive: false,
  questions: [{ id: "Q1", text: "Actor chính là ai?" }],
  gate_payload: null,
  events: [],
  error: null,
  ...patch,
});

const gatePayload = { type: "gate_ready" as const, step_id: "S-3.1", actions: ["accept" as const], regenerate_used: 0, calls_used: 2, spine_version: 21 };

beforeEach(() => {
  runPhase.mockReset().mockResolvedValue(undefined);
  runStep.mockReset();
  answerStep.mockReset().mockResolvedValue({ data: { accepted: true } });
  getRunState.mockReset();
  getActiveRunState.mockReset();
});

const setup = (onSpineChanged = vi.fn()) =>
  renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 12, onSpineChanged }));

describe("stepRunnerReducer — nguồn state và lượt đã tách", () => {
  it("state dựng lại từ run-state mang nguồn `restored`; lượt chạy trực tiếp là `live`", () => {
    expect(stepRunnerReducer(initialRunnerState, { type: "start", stepId: "S-3.1" }).source).toBe("live");
    expect(stepRunnerReducer(initialRunnerState, { type: "restored", state: run({}) }).source).toBe("restored");
  });

  it("lượt nền lỗi ⇒ interrupted kèm lỗi, để khối lỗi hiện nút làm lại", () => {
    const failed = stepRunnerReducer(initialRunnerState, {
      type: "restored",
      state: run({ status: "interrupted", stage: "draft", questions: null, error: { code: "AI_PROVIDER_ERROR", message: "provider chết" } }),
    });
    expect(failed).toMatchObject({ status: "interrupted", busy: false, error: { code: "AI_PROVIDER_ERROR" } });
  });

  it("luồng đóng lúc đang chờ trả lời ⇒ vẫn là thẻ hỏi, không phải lỗi", () => {
    const asking = stepRunnerReducer(stepRunnerReducer(initialRunnerState, { type: "start", stepId: "S-3.1" }), {
      type: "event",
      event: { type: "answer_needed", step_id: "S-3.1", questions: [{ id: "Q1", text: "Ai?" }] },
    });
    const detached = stepRunnerReducer(asking, { type: "detached" });
    expect(detached).toMatchObject({ status: "needs_input", busy: false, source: "restored", error: null });
    expect(detached.questions).toHaveLength(1);
  });

  it("đơn vị giai đoạn không có dấu chấm, id bước thì có", () => {
    expect(isPhaseUnit("S-4")).toBe(true);
    expect(isPhaseUnit("S-5@S03")).toBe(true);
    expect(isPhaseUnit("S-4.1")).toBe(false);
    expect(isPhaseUnit("S-5.2@S03")).toBe(false);
  });
});

describe("useStepRunner — trả lời khi không còn SSE", () => {
  it("reload giữa lúc chờ → trả lời → theo dõi run-state tới GateCard, không cần F5 thêm", async () => {
    getActiveRunState.mockResolvedValue({ data: run({}) });
    getRunState
      .mockResolvedValueOnce({ data: run({ status: "running", stage: "draft", alive: true, questions: null, events: [{ type: "answer_received", step_id: "S-3.1", count: 1 }] }) })
      .mockResolvedValue({ data: run({ status: "gate", stage: "gate", alive: true, questions: null, gate_payload: gatePayload }) });
    const onSpineChanged = vi.fn();
    const { result } = setup(onSpineChanged);

    await act(async () => void (await result.current.restore()));
    expect(result.current.state.status).toBe("needs_input");

    await act(async () => result.current.answer([{ question_id: "Q1", answer: "Quản trị viên" }]));
    expect(answerStep).toHaveBeenCalledWith("p1", "S-3.1", { session_id: "s1", answers: [{ question_id: "Q1", answer: "Quản trị viên" }] });
    expect(result.current.state).toMatchObject({ status: "drafting", busy: true });

    await waitFor(() => expect(result.current.state.events.some((e) => e.type === "answer_received")).toBe(true), { timeout: 8_000 });
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"), { timeout: 8_000 });
    expect(result.current.state.gate?.actions).toEqual(["accept"]);
    expect(onSpineChanged).toHaveBeenCalledWith(21);
  }, 20_000);

  it("lượt nền lỗi sau khi trả lời ⇒ hiện lỗi, dừng theo dõi", async () => {
    getActiveRunState.mockResolvedValue({ data: run({}) });
    getRunState.mockResolvedValue({ data: run({ status: "interrupted", stage: "draft", alive: true, questions: null, error: { code: "AI_PROVIDER_ERROR", message: "x" } }) });
    const { result } = setup();

    await act(async () => void (await result.current.restore()));
    await act(async () => result.current.answer([{ question_id: "Q1", answer: "x" }]));

    await waitFor(() => expect(result.current.state.status).toBe("interrupted"), { timeout: 8_000 });
    expect(result.current.state.error?.code).toBe("AI_PROVIDER_ERROR");
  }, 20_000);

  it("phỏng vấn đầu giai đoạn đã tách → trả lời → chạy lại cả giai đoạn", async () => {
    getActiveRunState.mockResolvedValue({ data: run({ step_id: "S-4" }) });
    const { result } = setup();

    await act(async () => void (await result.current.restore()));
    await act(async () => result.current.answer([{ question_id: "Q1", answer: "Đặt lịch" }]));

    expect(answerStep).toHaveBeenCalledWith("p1", "S-4", expect.anything());
    expect(runPhase).toHaveBeenCalledTimes(1);
    expect(runPhase.mock.calls[0][1]).toBe("S-4");
  });

  it("có luồng SSE sống ⇒ trả lời như cũ, không chạy lại giai đoạn hay hỏi run-state", async () => {
    let emit: (e: unknown) => void = () => undefined;
    let finish: () => void = () => undefined;
    runStep.mockImplementation(
      (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) =>
        new Promise<void>((resolve) => {
          emit = h.onEvent;
          finish = resolve;
        })
    );
    const { result } = setup();

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run("S-3.1");
    });
    await act(async () => emit({ type: "answer_needed", step_id: "S-3.1", questions: [{ id: "Q1", text: "Ai?" }] }));
    await act(async () => result.current.answer([{ question_id: "Q1", answer: "x" }]));
    await act(async () => {
      emit(gatePayload);
      finish();
      await running;
    });

    expect(result.current.state.status).toBe("gate_ready");
    expect(runPhase).not.toHaveBeenCalled();
    expect(getRunState).not.toHaveBeenCalled();
  });

  it("luồng đóng khi đang chờ trả lời (BE hết giờ chờ) ⇒ giữ thẻ hỏi thay vì báo lỗi", async () => {
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent({ type: "answer_needed", step_id: "S-3.1", questions: [{ id: "Q1", text: "Ai?" }] });
    });
    const { result } = setup();

    await act(async () => result.current.run("S-3.1"));

    expect(result.current.state).toMatchObject({ status: "needs_input", source: "restored", error: null });
  });
});
