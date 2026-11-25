/**
 * FLF-489: duyệt bước chạy lại thì quy trình dừng, không tự chạy bước tới lượt (tốn credit ngoài ý người dùng).
 * Hai lỗ cũ: (1) cổng dựng lại sau reload mất cờ "lượt lẻ"; (2) chuỗi cũ còn giữ giai đoạn khi chạy lẻ một bước khác.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";
import type { RunState } from "@/types/pipeline";

const runPhase = vi.fn();
const runStep = vi.fn();
const submitGate = vi.fn();
const getRunState = vi.fn();
const getActiveRunState = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  submitGate: (...args: unknown[]) => submitGate(...args),
  getRunState: (...args: unknown[]) => getRunState(...args),
  getActiveRunState: (...args: unknown[]) => getActiveRunState(...args),
  answerStep: vi.fn(),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

vi.mock("@/lib/api/spine", async (orig) => ({ ...(await orig<object>()), getSpine: vi.fn().mockResolvedValue({ data: null }) }));

const gateAt = (stepId: string) => ({
  type: "gate_ready" as const,
  step_id: stepId,
  actions: ["accept" as const],
  regenerate_used: 0,
  calls_used: 2,
});

const gateRun = (stepId: string): RunState => ({
  step_id: stepId,
  run_id: "r1",
  status: "gate",
  stage: "gate",
  detail_vi: "Chờ bạn duyệt",
  batch: null,
  started_at: new Date(1_000).toISOString(),
  last_event_at: new Date(2_000).toISOString(),
  alive: false,
  questions: [],
  gate_payload: { ...gateAt(stepId), spine_version: 21 },
  events: [],
  error: null,
});

beforeEach(() => {
  runPhase.mockReset().mockResolvedValue(undefined);
  runStep.mockReset();
  submitGate.mockReset();
  getRunState.mockReset().mockResolvedValue({ data: null });
  getActiveRunState.mockReset().mockResolvedValue({ data: null });
});

const setup = (onStoppedAfterRerun = vi.fn()) => ({
  onStoppedAfterRerun,
  ...renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 12, onSpineChanged: vi.fn(), onStoppedAfterRerun })),
});

describe("duyệt bước chạy lại (FLF-489)", () => {
  it("chuỗi cả giai đoạn đang dừng ở cổng, chạy lẻ một bước khác rồi duyệt ⇒ không chạy tiếp giai đoạn cũ", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent(gateAt("S-6.1"));
    });
    runStep.mockImplementation(async (_p: string, stepId: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent(gateAt(stepId));
    });
    submitGate.mockResolvedValue({ data: { spine_version: 13, next_step: "S-6.1" } });
    const { result, onStoppedAfterRerun } = setup();

    await act(async () => result.current.runWholePhase("S-6"));
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));
    await act(async () => result.current.run("S-7.3", { standalone: true }));
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));

    await act(async () => result.current.gate("accept"));
    expect(runPhase).toHaveBeenCalledTimes(1);
    expect(onStoppedAfterRerun).toHaveBeenCalledWith("S-7.3", "S-6.1");
  });

  it("cổng dựng lại sau reload, BE báo rerun ⇒ không chạy giai đoạn, báo trang dừng", async () => {
    getRunState.mockResolvedValue({ data: gateRun("S-7.3") });
    submitGate.mockResolvedValue({ data: { spine_version: 13, next_step: "S-2.2", rerun: true } });
    const { result, onStoppedAfterRerun } = setup();

    await act(async () => void (await result.current.restore("S-7.3")));
    expect(result.current.state.status).toBe("gate_ready");
    await act(async () => result.current.gate("accept"));

    expect(runPhase).not.toHaveBeenCalled();
    expect(onStoppedAfterRerun).toHaveBeenCalledWith("S-7.3", "S-2.2");
  });

  it("cổng dựng lại mà không có rerun ⇒ vẫn tự chạy giai đoạn kế như FLF-221", async () => {
    getRunState.mockResolvedValue({ data: gateRun("S-1.4") });
    submitGate.mockResolvedValue({ data: { spine_version: 13, next_step: "S-2.1" } });
    const { result, onStoppedAfterRerun } = setup();

    await act(async () => void (await result.current.restore("S-1.4")));
    await act(async () => result.current.gate("accept"));

    await waitFor(() => expect(runPhase).toHaveBeenCalledTimes(1));
    expect(runPhase.mock.calls[0][1]).toBe("S-2");
    expect(onStoppedAfterRerun).not.toHaveBeenCalled();
  });

  it("chuỗi chạy liền cả giai đoạn gặp cổng có rerun ⇒ vẫn chạy tiếp", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent(gateAt("S-6.1"));
    });
    submitGate.mockResolvedValue({ data: { spine_version: 13, next_step: "S-6.2", rerun: true } });
    const { result, onStoppedAfterRerun } = setup();

    await act(async () => result.current.runWholePhase("S-6"));
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));
    await act(async () => result.current.gate("accept"));

    await waitFor(() => expect(runPhase).toHaveBeenCalledTimes(2));
    expect(onStoppedAfterRerun).not.toHaveBeenCalled();
  });

  it("còn lượt sống khác của dự án (cổng bỏ dở) ⇒ dựng lại nó, không báo dừng", async () => {
    getRunState.mockResolvedValue({ data: gateRun("S-7.3") });
    getActiveRunState.mockResolvedValue({ data: gateRun("S-9.5") });
    submitGate.mockResolvedValue({ data: { spine_version: 13, next_step: "S-9.5", rerun: true } });
    const { result, onStoppedAfterRerun } = setup();

    await act(async () => void (await result.current.restore("S-7.3")));
    await act(async () => result.current.gate("accept"));

    expect(runPhase).not.toHaveBeenCalled();
    expect(onStoppedAfterRerun).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));
  });
});
