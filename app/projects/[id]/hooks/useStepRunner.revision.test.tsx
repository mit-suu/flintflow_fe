/**
 * Cổng chốt: lời AI sau `revision` phải hiện trước khi bước chạy lại; đáp án thẻ gõ kèm chữ đi trong MỘT request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";
import { ApiClientError } from "@/lib/api/client";

const runStep = vi.fn();
const submitGate = vi.fn();
const answerStep = vi.fn();
const runPhase = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  submitGate: (...args: unknown[]) => submitGate(...args),
  runStep: (...args: unknown[]) => runStep(...args),
  answerStep: (...args: unknown[]) => answerStep(...args),
  getRunState: vi.fn().mockResolvedValue({ data: null }),
  getActiveRunState: vi.fn().mockResolvedValue({ data: null }),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

vi.mock("@/lib/api/spine", () => ({ getSpine: vi.fn().mockResolvedValue({ data: { spine_version: 9 } }) }));

const gateReady = { type: "gate_ready" as const, step_id: "B-0.1", actions: ["accept" as const, "revision" as const], regenerate_used: 0, calls_used: 1 };

beforeEach(() => {
  runStep.mockReset();
  submitGate.mockReset();
  answerStep.mockReset().mockResolvedValue({ data: {} });
  runPhase.mockReset();
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

describe("gate 409 do chính lượt trước (P08, QLHS #5/#11)", () => {
  it("SPINE_VERSION_CONFLICT ⇒ đọc version mới nhất, gửi lại đúng một lần, không báo lỗi", async () => {
    submitGate
      .mockRejectedValueOnce(new ApiClientError(409, "SPINE_VERSION_CONFLICT", "Tài liệu vừa được cập nhật"))
      .mockResolvedValueOnce({ data: { spine_version: 10, next_step: "B-0.2" } });
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => h.onEvent(gateReady));
    const onSpineChanged = vi.fn();
    const { result } = renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged }));
    await act(async () => result.current.run("B-0.1"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.gate("accept");
    });
    expect(outcome).toBe("ok");
    expect(submitGate).toHaveBeenCalledTimes(2);
    expect(submitGate.mock.calls[1][2]).toMatchObject({ base_version: 9 });
    expect(onSpineChanged).toHaveBeenCalledWith(9);
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

describe("FLF-411 #20: nhắn sửa ở thẻ cổng đã cũ", () => {
  it("chạy lại đúng bước đó kèm lời nhắn (dừng ở cổng thật), không chạy cả giai đoạn để bước tự qua", async () => {
    runStep.mockImplementation(async (_p: string, s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => h.onEvent({ ...gateReady, step_id: s }));
    const { result } = renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn() }));
    await act(async () => result.current.run("B-1.1"));
    submitGate.mockRejectedValueOnce(new ApiClientError(409, "STEP_NOT_RUNNABLE", "Bước B-1.1 không ở cổng chốt"));
    runStep.mockClear();

    await act(async () => result.current.gate("revision", "đổi tên hệ thống thành ShuttleBook"));

    expect(runPhase).not.toHaveBeenCalled();
    expect(runStep).toHaveBeenCalledTimes(1);
    expect(runStep.mock.calls[0][1]).toBe("B-1.1");
    expect(runStep.mock.calls[0][2]).toMatchObject({ message: "đổi tên hệ thống thành ShuttleBook" });
    await waitFor(() => expect(result.current.state.status).toBe("gate_ready"));

    // Duyệt bản sửa ⇒ chuỗi chạy tiếp giai đoạn B-1
    submitGate.mockResolvedValueOnce({ data: { spine_version: 10, next_step: "B-1.2" } });
    await act(async () => result.current.gate("accept"));
    expect(runPhase).toHaveBeenCalledTimes(1);
    expect(runPhase.mock.calls[0][1]).toBe("B-1");
  });
});

describe("gate revision ngoài mục của bước (FLF-482)", () => {
  it("route_to_change ⇒ bước chạy lại rồi gọi onRouteToChange với câu user", async () => {
    const order: string[] = [];
    submitGate.mockResolvedValue({ data: { spine_version: 5, next_step: null, message_vi: "Phần này nằm ở mục khác.", route_to_change: { instruction: "  bản 1.0 bỏ hai nhóm  " } } });
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => {
      order.push("run");
      h.onEvent(gateReady);
    });
    const onRouteToChange = vi.fn((instruction: string) => order.push(`route:${instruction}`));
    const { result } = renderHook(() =>
      useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn(), onRouteToChange })
    );
    await act(async () => result.current.run("B-0.1"));
    order.length = 0;

    await act(async () => result.current.gate("revision", "bản 1.0 bỏ hai nhóm"));

    expect(order).toEqual(["run", "route:bản 1.0 bỏ hai nhóm"]);
    expect(onRouteToChange).toHaveBeenCalledWith("bản 1.0 bỏ hai nhóm", "B-0.1");
  });

  it("không có route_to_change ⇒ không mở Sửa tài liệu", async () => {
    submitGate.mockResolvedValue({ data: { spine_version: 5, next_step: null } });
    runStep.mockImplementation(async (_p: string, _s: string, _r: unknown, h: { onEvent: (e: unknown) => void }) => h.onEvent(gateReady));
    const onRouteToChange = vi.fn();
    const { result } = renderHook(() =>
      useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 4, onSpineChanged: vi.fn(), onRouteToChange })
    );
    await act(async () => result.current.run("B-0.1"));
    await act(async () => result.current.gate("revision", "sửa"));
    expect(onRouteToChange).not.toHaveBeenCalled();
  });
});
