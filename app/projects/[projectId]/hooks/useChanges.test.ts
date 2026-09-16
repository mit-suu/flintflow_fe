import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as spineApi from "@/lib/api/spine";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { useChanges } from "./useChanges";
import type { ApplyResult } from "@/types/pipeline";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

const seedActor = async () => {
  const base_version = await version();
  await applyChanges(P, {
    base_version,
    ops: [{ op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Ban đầu" } }],
  });
  return version();
};

describe("useChanges", () => {
  it("requestPreview theo instruction → confirmPreview gọi onApplied với ApplyResult", async () => {
    const baseVersion = await seedActor();
    const onApplied = vi.fn();
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, onApplied));

    await result.current.requestPreview("làm rõ vai trò");
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    expect(result.current.clarification).toBeNull();

    await result.current.confirmPreview();

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    const [applyResult] = onApplied.mock.calls[0] as [ApplyResult];
    expect(applyResult.spine_version).toBe(baseVersion + 1);
    await waitFor(() => expect(result.current.preview).toBeNull());
  });

  it("lệnh không tìm được đối tượng ⇒ clarification, không có preview", async () => {
    const baseVersion = await version();
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn()));

    await result.current.requestPreview("đổi gì đó");

    await waitFor(() => expect(result.current.clarification).toBeTruthy());
    expect(result.current.preview).toBeNull();
  });

  it("loadHistory truyền `from = latestSeq - 19` khi getLatestSeq có giá trị (giới hạn 20 dòng, không tải toàn bộ)", async () => {
    const baseVersion = await seedActor();
    const listChangesSpy = vi.spyOn(spineApi, "listChanges");
    const getLatestSeq = () => 42;
    const { result } = renderHook(() => useChanges(P, () => baseVersion, getLatestSeq, vi.fn()));

    await result.current.loadHistory();

    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    expect(listChangesSpy).toHaveBeenCalledWith(P, { from: 23 });
    expect(result.current.error).toBeNull();
    listChangesSpy.mockRestore();
  });

  it("getLatestSeq trả null (chưa xác định) ⇒ loadHistory không giới hạn `from`", async () => {
    const baseVersion = await seedActor();
    const listChangesSpy = vi.spyOn(spineApi, "listChanges");
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn()));

    await result.current.loadHistory();

    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    expect(listChangesSpy).toHaveBeenCalledWith(P, {});
    expect(result.current.error).toBeNull();
    listChangesSpy.mockRestore();
  });

  it("undo() gọi onApplied với kết quả đã revert", async () => {
    const baseVersion = await seedActor();
    const onApplied = vi.fn();
    const { result, rerender } = renderHook(
      ({ base }: { base: number }) => useChanges(P, () => base, () => null, onApplied),
      { initialProps: { base: baseVersion } }
    );

    await result.current.requestPreview("cập nhật mô tả");
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    await result.current.confirmPreview();
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    const appliedVersion = (onApplied.mock.calls[0][0] as ApplyResult).spine_version;
    rerender({ base: appliedVersion });

    await result.current.undo();

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(2));
    const undone = onApplied.mock.calls[1][0] as ApplyResult;
    expect(undone.spine.actors[0]?.description).toBe("Ban đầu");
  });
});
