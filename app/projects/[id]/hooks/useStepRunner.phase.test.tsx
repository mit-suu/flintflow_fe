/**
 * "Chạy cả giai đoạn" phải sống qua một cổng chốt giữa chừng (02-reduce-stops R2).
 *
 * Lượt test tay gãy đúng ở đây: chuỗi dừng ở B-1.3 để hỏi, user Accept, rồi màn hình quay về thẻ "Chạy
 * bước này" của B-1.4 — tức là từ bước đó trở đi user lại phải bấm chạy từng bước, đúng thứ R2 xoá đi.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";

const runPhase = vi.fn();
const submitGate = vi.fn();
const runStep = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  submitGate: (...args: unknown[]) => submitGate(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  answerStep: vi.fn(),
  getRunState: vi.fn().mockResolvedValue({ data: null }),
  getActiveRunState: vi.fn().mockResolvedValue({ data: null }),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

const setup = () =>
  renderHook(() =>
    useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 12, onSpineChanged: vi.fn() })
  );

const gateAt = (stepId: string) => ({
  type: "gate_ready" as const,
  step_id: stepId,
  actions: ["accept" as const],
  regenerate_used: 0,
  calls_used: 2,
});

beforeEach(() => {
  runPhase.mockReset();
  submitGate.mockReset().mockResolvedValue({ data: { spine_version: 13, accepted: true } });
  runStep.mockReset();
});

describe("runWholePhase + gate", () => {
  it("chuỗi dừng ở cổng chốt: Accept xong chạy tiếp chính giai đoạn đó", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent({ type: "phase_progress", step_id: "B-1.3", phase: "B-1", step_index: 3, step_total: 6, label_vi: "Giá trị" });
      h.onEvent(gateAt("B-1.3"));
    });
    const { result } = setup();

    await act(async () => result.current.runWholePhase("B-1"));
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));

    await act(async () => result.current.gate("accept"));
    await waitFor(() => expect(runPhase).toHaveBeenCalledTimes(2));
    expect(runPhase.mock.calls[1][1]).toBe("B-1");
  });

  it("giai đoạn chạy hết mà không có cổng chốt nào ⇒ về rảnh, không treo màn hình", async () => {
    runPhase.mockResolvedValue(undefined); // BE: "Đã xong giai đoạn này" — không sự kiện nào
    const { result } = setup();

    await act(async () => result.current.runWholePhase("B-2"));
    await waitFor(() => expect(result.current.state.status).toBe("idle"));
    expect(result.current.state.busy).toBe(false);
  });

  it("chuỗi chạy hết giai đoạn mà không dừng: Accept của bước lẻ sau đó không khởi động chuỗi mới", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent({ type: "auto_accepted", step_id: "B-1.6", phase: "B-1", reason_vi: "Không có gì cần bạn quyết" });
    });
    runStep.mockImplementation(async (_p: string, stepId: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent(gateAt(stepId));
    });
    const { result } = setup();

    await act(async () => result.current.runWholePhase("B-1"));
    await act(async () => result.current.run("B-2.1"));
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));

    await act(async () => result.current.gate("accept"));
    expect(runPhase).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("idle");
  });
});
