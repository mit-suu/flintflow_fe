/**
 * FLF-400: bấm Gửi / Enter hai lần trong cùng một khung render ⇒ hai lần gọi đều đọc state "rảnh". Khoá ref ở cửa vào
 * phải chặn lần thứ hai: đúng một request cho mỗi lối (chạy bước, chạy cả giai đoạn, trả lời, duyệt).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";

const runPhase = vi.fn();
const runStep = vi.fn();
const answerStep = vi.fn();
const submitGate = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  answerStep: (...args: unknown[]) => answerStep(...args),
  submitGate: (...args: unknown[]) => submitGate(...args),
  getRunState: vi.fn().mockResolvedValue({ data: null }),
  getActiveRunState: vi.fn().mockResolvedValue({ data: null }),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

vi.mock("@/lib/api/spine", () => ({ getSpine: vi.fn().mockResolvedValue({ data: { spine_version: 12 } }) }));

type Handlers = { onEvent: (e: unknown) => void; signal: AbortSignal };

const setup = () => renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 12, onSpineChanged: vi.fn() }));

/** Luồng mở cho tới khi bị huỷ — như SSE đang chạy dở. */
const openUntilAborted = (h: Handlers) => new Promise<void>((resolve) => h.signal.addEventListener("abort", () => resolve()));

const answerNeeded = (stepId: string) => ({ type: "answer_needed" as const, step_id: stepId, questions: [{ id: "Q1", text: "Ai dùng?" }] });
const gateAt = (stepId: string) => ({ type: "gate_ready" as const, step_id: stepId, actions: ["accept" as const, "revision" as const], regenerate_used: 0, calls_used: 1 });

beforeEach(() => {
  runPhase.mockReset();
  runStep.mockReset();
  answerStep.mockReset().mockResolvedValue({ data: { accepted: true } });
  submitGate.mockReset().mockResolvedValue({ data: { spine_version: 13, accepted: true } });
});

describe("FLF-400: chặn gửi lặp ở cửa vào", () => {
  it("runWholePhase gọi 2 lần trong cùng một tick ⇒ runPhase chỉ gọi 1 lần", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: Handlers) => openUntilAborted(h));
    const { result } = setup();

    act(() => {
      void result.current.runWholePhase("B-1", { message: "Bắt đầu" });
      void result.current.runWholePhase("B-1", { message: "Bắt đầu" });
    });

    expect(runPhase).toHaveBeenCalledTimes(1);
    expect(result.current.locked("run")).toBe(true);
    await act(async () => result.current.reset());
  });

  it("run gọi 2 lần liền ⇒ runStep chỉ gọi 1 lần; lượt xong thì chạy lại được", async () => {
    runStep.mockImplementation(async (_p: string, stepId: string, _req: unknown, h: Handlers) => h.onEvent(gateAt(stepId)));
    const { result } = setup();

    await act(async () => {
      await Promise.all([result.current.run("B-1.5"), result.current.run("B-1.5")]);
    });
    expect(runStep).toHaveBeenCalledTimes(1);
    expect(result.current.locked("run")).toBe(false);

    await act(async () => result.current.run("B-1.5"));
    expect(runStep).toHaveBeenCalledTimes(2);
  });

  it("Huỷ lượt cũ và chạy lại: cancel nhả khoá ngay, không chờ luồng cũ đóng hẳn", async () => {
    runStep.mockImplementation(async (_p: string, _s: string, _req: unknown, h: Handlers) => openUntilAborted(h));
    const { result } = setup();

    act(() => void result.current.run("B-1.5"));
    await act(async () => {
      await result.current.cancel();
      void result.current.run("B-1.5");
    });

    expect(runStep).toHaveBeenCalledTimes(2);
    await act(async () => result.current.reset());
  });

  it("đang chờ trả lời (luồng chạy vẫn mở): trả lời gửi được, nhưng gửi 2 lần liền ⇒ answerStep chỉ gọi 1 lần", async () => {
    runStep.mockImplementation(async (_p: string, stepId: string, _req: unknown, h: Handlers) => {
      h.onEvent(answerNeeded(stepId));
      return openUntilAborted(h);
    });
    const { result } = setup();

    await act(async () => {
      void result.current.run("B-1.5");
    });
    expect(result.current.state.status).toBe("needs_input");

    await act(async () => {
      await Promise.all([result.current.answer([], "Sinh viên"), result.current.answer([], "Sinh viên")]);
    });
    expect(answerStep).toHaveBeenCalledTimes(1);
    expect(result.current.locked("answer")).toBe(false);
    await act(async () => result.current.reset());
  });

  it("gate gọi 2 lần liền ⇒ submitGate chỉ gọi 1 lần, lần sau trả `skipped`", async () => {
    runStep.mockImplementation(async (_p: string, stepId: string, _req: unknown, h: Handlers) => h.onEvent(gateAt(stepId)));
    const { result } = setup();
    await act(async () => result.current.run("B-1.5"));

    let outcomes: string[] = [];
    await act(async () => {
      outcomes = await Promise.all([result.current.gate("accept"), result.current.gate("accept")]);
    });

    expect(submitGate).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual(["ok", "skipped"]);
    expect(result.current.locked("gate")).toBe(false);
  });
});
