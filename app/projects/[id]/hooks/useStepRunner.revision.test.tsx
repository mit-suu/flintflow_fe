/**
 * Cổng chốt: lời AI sau `revision` phải hiện trước khi bước chạy lại; đáp án thẻ gõ kèm chữ đi trong MỘT request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";

const runStep = vi.fn();
const submitGate = vi.fn();
const answerStep = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: vi.fn(),
  submitGate: (...args: unknown[]) => submitGate(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  answerStep: (...args: unknown[]) => answerStep(...args),
  getRunState: vi.fn().mockResolvedValue({ data: null }),
  getActiveRunState: vi.fn().mockResolvedValue({ data: null }),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

const gateReady = { type: "gate_ready" as const, step_id: "B-0.1", actions: ["accept" as const, "revision" as const], regenerate_used: 0, calls_used: 1 };

beforeEach(() => {
  runStep.mockReset();
  submitGate.mockReset();
  answerStep.mockReset().mockResolvedValue({ data: {} });
});

describe("gate revision", () => {
  it("message_vi của lượt sửa hiện trước khi bước chạy lại", async () => {
    const order: string[] = [];
    submitGate.mockResolvedValue({ data: { spine_version: 5, next_step: null, message_vi: "  Được rồi, tôi chuyển sang app điện thoại.  " } });
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => {
      order.push("run");
      h.onEvent(gateReady);
    });
    const onRevisionMessage = vi.fn((message: string) => order.push(`msg:${message}`));
    const { result } = renderHook(() =>
      useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn(), onRevisionMessage })
    );
    await act(async () => result.current.run("B-0.1"));
    order.length = 0;

    await act(async () => result.current.gate("revision", "bệnh nhân dùng app điện thoại"));

    expect(order).toEqual(["msg:Được rồi, tôi chuyển sang app điện thoại.", "run"]);
    expect(onRevisionMessage).toHaveBeenCalledWith("Được rồi, tôi chuyển sang app điện thoại.", "B-0.1");
  });

  it("không có message_vi, hoặc không phải revision ⇒ không thêm tin", async () => {
    submitGate.mockResolvedValueOnce({ data: { spine_version: 5, next_step: null } });
    submitGate.mockResolvedValueOnce({ data: { spine_version: 6, next_step: null, message_vi: "Nói gì đó" } });
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => h.onEvent(gateReady));
    const onRevisionMessage = vi.fn();
    const { result } = renderHook(() =>
      useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn(), onRevisionMessage })
    );
    await act(async () => result.current.run("B-0.1"));
    await act(async () => result.current.gate("revision", "sửa"));
    await act(async () => result.current.gate("regenerate"));
    expect(onRevisionMessage).not.toHaveBeenCalled();
  });
});

describe("answer với đáp án thẻ + chữ gõ", () => {
  it("gửi MỘT request /answer mang cả đáp án thẻ lẫn tin gõ", async () => {
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent({ type: "answer_needed", step_id: "B-0.1", questions: [{ id: "Q1", text: "Nền tảng?" }, { id: "Q2", text: "Ai dùng?" }] });
    });
    const { result } = renderHook(() =>
      useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn() })
    );
    await act(async () => result.current.run("B-0.1"));
    await waitFor(() => expect(result.current.state.status).toBe("needs_input"));

    await act(async () => result.current.answer([{ question_id: "Q1", answer: "Web" }], "Lễ tân và bác sĩ"));

    expect(answerStep).toHaveBeenCalledTimes(1);
    expect(answerStep).toHaveBeenCalledWith("p1", "B-0.1", { session_id: "s1", answers: [{ question_id: "Q1", answer: "Web" }], message: "Lễ tân và bác sĩ" });
  });
});
