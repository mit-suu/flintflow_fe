import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as spineApi from "@/lib/api/spine";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { useChanges } from "./useChanges";
import { ApiClientError } from "@/lib/api/client";
import { HOOK_ERROR } from "@/lib/hook-errors";
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

  it("FLF-294: confirmPreview gửi kèm reason + change_request (sau baseline lượt áp là một CR)", async () => {
    const baseVersion = await seedActor();
    const applySpy = vi.spyOn(spineApi, "applyChanges");
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn()));

    await result.current.requestPreview("làm rõ vai trò");
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    const changeRequest = { requester: "Chị Lan", source: { kind: "meeting_minutes" as const, ref: "Biên bản 15/10" } };
    await result.current.confirmPreview("Khách đổi tên vai trò", changeRequest);

    await waitFor(() => expect(applySpy).toHaveBeenCalled());
    expect(applySpy.mock.calls.at(-1)?.[1]).toMatchObject({ reason: "Khách đổi tên vai trò", change_request: changeRequest });
    applySpy.mockRestore();
  });

  it("FLF-278 đợt 3: xem trước lô op tự dựng (không gọi model) → xác nhận gửi lại đúng lô + preview_id", async () => {
    const baseVersion = await seedActor();
    const onApplied = vi.fn();
    const apply = vi.spyOn(spineApi, "applyChanges");
    const ops = [{ op: "set" as const, path: "actors[id=A01].description", value: "Từ thư viện tổ chức" }];
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, onApplied));

    expect(await result.current.requestOpsPreview(ops, "Dùng nội dung của tổ chức")).toBe("preview");
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    expect(result.current.pendingInstruction).toBe("Dùng nội dung của tổ chức");

    await result.current.confirmPreview();
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    const sent = apply.mock.calls.at(-1)![1];
    expect(sent).toMatchObject({ ops, preview_id: expect.any(String) });
    expect(sent).not.toHaveProperty("instruction");
    apply.mockRestore();
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

describe("useChanges - cổng đồng bộ trước khi gửi và 409", () => {
  it("syncBeforeSend chạy trước /changes/preview và base_version lấy SAU cổng", async () => {
    const baseVersion = await seedActor();
    const previewSpy = vi.spyOn(spineApi, "previewChanges");
    let current = baseVersion - 1; // tab đang giữ bản cũ
    const syncBeforeSend = vi.fn(async () => {
      current = baseVersion;
      return true;
    });
    const { result } = renderHook(() => useChanges(P, () => current, () => null, vi.fn(), () => null, { syncBeforeSend }));

    await act(async () => void (await result.current.requestPreview("làm rõ vai trò")));
    expect(syncBeforeSend).toHaveBeenCalledTimes(1);
    expect(previewSpy).toHaveBeenCalledWith(P, expect.objectContaining({ base_version: baseVersion }));
    previewSpy.mockRestore();
  });

  it("confirmPreview: cổng vừa kéo Spine lên bản mới hơn bản xem trước ⇒ bỏ xem trước, không gọi /changes", async () => {
    const baseVersion = await seedActor();
    const applySpy = vi.spyOn(spineApi, "applyChanges");
    let current = baseVersion;
    let synced = false;
    const syncBeforeSend = vi.fn(async () => {
      if (synced) current = baseVersion + 1;
      return synced;
    });
    const { result } = renderHook(() => useChanges(P, () => current, () => null, vi.fn(), () => null, { syncBeforeSend }));

    await act(async () => void (await result.current.requestPreview("làm rõ vai trò")));
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    applySpy.mockClear();

    synced = true; // giữa lúc xem trước và bấm Áp dụng, nơi khác ghi thêm
    await act(async () => void (await result.current.confirmPreview()));
    expect(applySpy).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBe(HOOK_ERROR.documentChanged);
    applySpy.mockRestore();
  });

  it("409 SPINE_VERSION_CONFLICT ⇒ onConflict một lần, báo 'tài liệu vừa thay đổi', bỏ xem trước, KHÔNG tự gửi lại", async () => {
    const baseVersion = await seedActor();
    const onConflict = vi.fn();
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn(), () => null, { onConflict }));

    await act(async () => void (await result.current.requestPreview("làm rõ vai trò")));
    await waitFor(() => expect(result.current.preview).not.toBeNull());

    const applySpy = vi.spyOn(spineApi, "applyChanges").mockRejectedValue(new ApiClientError(409, "SPINE_VERSION_CONFLICT", "stale"));
    await act(async () => void (await result.current.confirmPreview()));
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(HOOK_ERROR.documentChanged);
    expect(result.current.preview).toBeNull();
    applySpy.mockRestore();
  });

  it("lỗi của cổng không chặn gửi", async () => {
    const baseVersion = await seedActor();
    const syncBeforeSend = vi.fn(async (): Promise<boolean> => {
      throw new Error("network");
    });
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn(), () => null, { syncBeforeSend }));
    await act(async () => void (await result.current.requestPreview("làm rõ vai trò")));
    await waitFor(() => expect(result.current.preview).not.toBeNull());
  });

  it("FLF-400: requestPreview gọi 2 lần liền ⇒ chỉ 1 request xem trước, lần sau trả `skipped`", async () => {
    const baseVersion = await seedActor();
    const previewSpy = vi.spyOn(spineApi, "previewChanges");
    const { result } = renderHook(() => useChanges(P, () => baseVersion, () => null, vi.fn()));

    let outcomes: string[] = [];
    await act(async () => {
      outcomes = await Promise.all([result.current.requestPreview("làm rõ vai trò"), result.current.requestPreview("làm rõ vai trò")]);
    });

    expect(previewSpy).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual(["preview", "skipped"]);
    previewSpy.mockRestore();
  });
});
