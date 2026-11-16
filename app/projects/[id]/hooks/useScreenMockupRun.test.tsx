import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelScreenMockupRun, getScreenMockupRun } from "@/lib/api/projects";
import type { ScreenMockupRunView } from "@/types/project";
import { RUN_POLL_MS, useScreenMockupRun } from "./useScreenMockupRun";

vi.mock("@/lib/api/projects", () => ({ getScreenMockupRun: vi.fn(), cancelScreenMockupRun: vi.fn() }));

const view = (over: Partial<ScreenMockupRunView> = {}): ScreenMockupRunView => ({
  run_id: "r1",
  status: "running",
  stopping: false,
  total: 2,
  completed: 0,
  done: [],
  failed: [],
  fell_back_to_system: [],
  pending: ["SCR-01", "SCR-02"],
  suggested_color: null,
  ...over,
});
const reply = (v: ScreenMockupRunView | null) => ({ data: v, error: null }) as never;

describe("useScreenMockupRun (FLF-410)", () => {
  beforeEach(() => {
    vi.mocked(getScreenMockupRun).mockReset();
    vi.mocked(cancelScreenMockupRun).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("lượt cũ đã xong ⇒ không hiện; tắt ⇒ không hỏi BE", async () => {
    vi.mocked(getScreenMockupRun).mockResolvedValue(reply(view({ status: "done", completed: 2 })));
    const { result, rerender } = renderHook(({ on }) => useScreenMockupRun("p1", on, () => {}), { initialProps: { on: false } });
    expect(getScreenMockupRun).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(getScreenMockupRun).toHaveBeenCalledWith("p1"));
    expect(result.current.run).toBeNull();
    expect(result.current.running).toBe(false);
  });

  it("đang chạy dở ⇒ theo dõi, hỏi lại mỗi nhịp; màn xong tăng ⇒ onProgress; xong ⇒ thôi hỏi", async () => {
    // Đồng hồ giả hoàn toàn (không trôi theo giờ thật) ⇒ mỗi nhịp hỏi tiến độ chỉ xảy ra khi test tua
    vi.useFakeTimers();
    const onProgress = vi.fn();
    vi.mocked(getScreenMockupRun)
      .mockResolvedValueOnce(reply(view()))
      .mockResolvedValueOnce(reply(view()))
      .mockResolvedValueOnce(reply(view({ completed: 1, done: ["SCR-01"] })))
      .mockResolvedValue(reply(view({ status: "done", completed: 2, done: ["SCR-01", "SCR-02"] })));
    const { result } = renderHook(() => useScreenMockupRun("p1", true, onProgress));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.running).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(RUN_POLL_MS));
    expect(onProgress).not.toHaveBeenCalled(); // chưa đổi gì
    await act(async () => vi.advanceTimersByTimeAsync(RUN_POLL_MS));
    expect(onProgress).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(RUN_POLL_MS));
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(result.current.run?.status).toBe("done");
    expect(result.current.running).toBe(false);

    const calls = vi.mocked(getScreenMockupRun).mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(RUN_POLL_MS * 3));
    expect(getScreenMockupRun).toHaveBeenCalledTimes(calls);
  });

  it("GET lúc mở trang về sau khi đã bấm chạy ⇒ không xoá lượt đang chạy", async () => {
    let resolveInitial: (v: never) => void = () => {};
    vi.mocked(getScreenMockupRun).mockReturnValueOnce(new Promise((r) => (resolveInitial = r)) as never);
    const { result } = renderHook(() => useScreenMockupRun("p1", true, () => {}));
    act(() => result.current.started(view()));
    await act(async () => resolveInitial(reply(null)));
    expect(result.current.run?.run_id).toBe("r1");
    expect(result.current.running).toBe(true);
  });

  it("started ⇒ hiện ngay; cancel ⇒ áp kết quả BE; dismiss ⇒ ẩn", async () => {
    vi.mocked(getScreenMockupRun).mockResolvedValue(reply(null));
    vi.mocked(cancelScreenMockupRun).mockResolvedValue(reply(view({ status: "cancelled", completed: 1, done: ["SCR-01"] })));
    const { result } = renderHook(() => useScreenMockupRun("p1", true, () => {}));
    await waitFor(() => expect(getScreenMockupRun).toHaveBeenCalled());

    act(() => result.current.started(view()));
    expect(result.current.running).toBe(true);
    await act(async () => result.current.cancel());
    expect(cancelScreenMockupRun).toHaveBeenCalledWith("p1");
    expect(result.current.run?.status).toBe("cancelled");
    act(() => result.current.dismiss());
    expect(result.current.run).toBeNull();
  });
});
