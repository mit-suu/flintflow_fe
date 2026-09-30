/**
 * Lượt kết thúc bằng lỗi (vd DRAFT_REJECTED sau khi thử lại hết lần) phải hiện khối lỗi, không đứng im ở "AI đang làm…".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStepRunner } from "./useStepRunner";

const runPhase = vi.fn();
const getRunState = vi.fn();
const getActiveRunState = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  runPhase: (...args: unknown[]) => runPhase(...args),
  submitGate: vi.fn(),
  runStep: vi.fn(),
  answerStep: vi.fn().mockResolvedValue({ data: {} }),
  getRunState: (...args: unknown[]) => getRunState(...args),
  getActiveRunState: (...args: unknown[]) => getActiveRunState(...args),
  cancelRun: vi.fn().mockResolvedValue({ data: { cancelled: true, run_id: null } }),
}));

const setup = () => renderHook(() => useStepRunner({ projectId: "p1", sessionId: "s1", getBaseVersion: () => 3, onSpineChanged: vi.fn() }));

const deadRun = {
  step_id: "B-1.6",
  run_id: "r1",
  status: "interrupted" as const,
  stage: "draft" as const,
  detail_vi: null,
  batch: null,
  started_at: "2026-09-30T00:00:00Z",
  last_event_at: "2026-09-30T00:00:00Z",
  alive: false,
  questions: null,
  gate_payload: null,
  events: [],
  error: { code: "DRAFT_REJECTED", message: "Bản nháp bị từ chối" },
};

beforeEach(() => {
  runPhase.mockReset();
  getRunState.mockReset();
  getActiveRunState.mockReset();
});

describe("lượt kết thúc bằng lỗi", () => {
  it("chạy cả giai đoạn gặp sự kiện error ⇒ giữ lỗi, không reset về rảnh", async () => {
    runPhase.mockImplementation(async (_p: string, _phase: string, _req: unknown, h: { onEvent: (e: unknown) => void }) => {
      h.onEvent({ type: "phase_progress", step_id: "B-1.6", phase: "B-1", step_index: 6, step_total: 6, label_vi: "Rủi ro" });
      h.onEvent({ type: "error", step_id: "B-1.6", code: "DRAFT_REJECTED", message: "Bản nháp bị từ chối" });
    });
    const { result } = setup();

    await act(async () => result.current.runWholePhase("B-1"));

    expect(result.current.state).toMatchObject({ status: "error", busy: false, error: { code: "DRAFT_REJECTED" } });
  });

  it("theo dõi nền thấy lượt đã chết kèm lỗi ⇒ hiện lỗi của lượt, không chỉ 'gián đoạn'", async () => {
    getActiveRunState.mockResolvedValue({ data: { ...deadRun, status: "running", alive: true, error: null } });
    getRunState.mockResolvedValue({ data: deadRun });
    const { result } = setup();

    await act(async () => void (await result.current.restore()));
    await waitFor(() => expect(result.current.state.status).toBe("interrupted"), { timeout: 8_000 });
    expect(result.current.state.error).toMatchObject({ code: "DRAFT_REJECTED" });
    expect(result.current.state.busy).toBe(false);
  }, 20_000);
});
