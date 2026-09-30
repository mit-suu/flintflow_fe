/**
 * Tab mở giữa lượt chạy ở nơi khác (FLF-235): runner `idle` nhưng bước `running` ⇒ hỏi run-state mỗi 5 s, lượt sống thì
 * dựng lại, hết lượt thì tải lại — và dừng hẳn khi rời trang.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FOLLOW_TICK_MS, MAX_SETTLED_STREAK, useFollowRunningElsewhere } from "./useFollowRunningElsewhere";
import type { RunState } from "@/types/pipeline";

const getActiveRunState = vi.fn();

vi.mock("@/lib/api/pipeline", () => ({
  getActiveRunState: (...args: unknown[]) => getActiveRunState(...args),
}));

const run = (patch: Partial<RunState>): RunState => ({
  step_id: "B-2.3",
  run_id: "r1",
  status: "running",
  stage: "draft",
  detail_vi: "Đang soạn",
  batch: null,
  started_at: new Date(1_000).toISOString(),
  last_event_at: new Date(2_000).toISOString(),
  alive: true,
  questions: null,
  gate_payload: null,
  events: [],
  error: null,
  ...patch,
});

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  getActiveRunState.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useFollowRunningElsewhere", () => {
  it("lượt còn sống (BE đang chờ trả lời / ở cổng) ⇒ gọi restore trong ≤ 5 s, không tải lại", async () => {
    getActiveRunState.mockResolvedValue({ data: run({ status: "waiting_answer", questions: [{ id: "Q1", text: "?" }] }) });
    const restore = vi.fn().mockResolvedValue(null);
    const onSettled = vi.fn();
    renderHook(() => useFollowRunningElsewhere({ active: true, projectId: "p1", restore, onSettled }));

    await flush(FOLLOW_TICK_MS - 1);
    expect(getActiveRunState).not.toHaveBeenCalled();
    await flush(1);
    expect(getActiveRunState).toHaveBeenCalledWith("p1");
    expect(restore).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("không còn lượt sống ⇒ gọi onSettled (tải lại steps / tiến độ / Spine); lỗi mạng ⇒ bỏ qua nhịp đó, không tải lại", async () => {
    getActiveRunState.mockResolvedValueOnce({ data: null }).mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: null });
    const restore = vi.fn();
    const onSettled = vi.fn();
    renderHook(() => useFollowRunningElsewhere({ active: true, projectId: "p1", restore, onSettled }));

    await flush(FOLLOW_TICK_MS * 2);
    expect(getActiveRunState).toHaveBeenCalledTimes(2);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
  });

  it("BE nói không có lượt sống liên tiếp quá ngưỡng mà vẫn active ⇒ dừng hỏi, không tải lại mãi", async () => {
    getActiveRunState.mockResolvedValue({ data: null });
    const onSettled = vi.fn();
    renderHook(() => useFollowRunningElsewhere({ active: true, projectId: "p1", restore: vi.fn(), onSettled }));

    await flush(FOLLOW_TICK_MS * (MAX_SETTLED_STREAK + 4));
    expect(onSettled).toHaveBeenCalledTimes(MAX_SETTLED_STREAK);
    expect(getActiveRunState).toHaveBeenCalledTimes(MAX_SETTLED_STREAK);
  });

  it("lượt đã chết (alive=false) ⇒ onSettled, không restore", async () => {
    getActiveRunState.mockResolvedValue({ data: run({ alive: false }) });
    const restore = vi.fn();
    const onSettled = vi.fn();
    renderHook(() => useFollowRunningElsewhere({ active: true, projectId: "p1", restore, onSettled }));

    await flush(FOLLOW_TICK_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
  });

  it("không active ⇒ không gọi API; unmount ⇒ không gọi thêm", async () => {
    getActiveRunState.mockResolvedValue({ data: null });
    const onSettled = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useFollowRunningElsewhere({ active, projectId: "p1", restore: vi.fn(), onSettled }), {
      initialProps: { active: false },
    });

    await flush(FOLLOW_TICK_MS * 2);
    expect(getActiveRunState).not.toHaveBeenCalled();

    rerender({ active: true });
    await flush(FOLLOW_TICK_MS);
    expect(getActiveRunState).toHaveBeenCalledTimes(1);

    unmount();
    await flush(FOLLOW_TICK_MS * 3);
    expect(getActiveRunState).toHaveBeenCalledTimes(1);
  });
});
