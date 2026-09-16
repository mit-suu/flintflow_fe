import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { useFlags } from "./useFlags";

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

const seedFlag = async (overrides: { id: string; level: "red" | "yellow"; rule_id: string }) => {
  const base_version = await version();
  await applyChanges(P, {
    base_version,
    ops: [
      {
        op: "add",
        path: "flags[]",
        value: {
          id: overrides.id,
          level: overrides.level,
          rule_id: overrides.rule_id,
          section_id: "fixed:2.1",
          message: "Actor mồ côi",
          remediation_step: "S-3.1",
          opened_at_version: 1,
          resolved_at: null,
          waived_by_user: false,
          waive_reason: null,
          waived_at_version: null,
        },
      },
    ],
  });
  return version();
};

describe("useFlags", () => {
  it("tải cờ khi có spineVersion; waive hợp lệ cập nhật danh sách tại chỗ (DoD #1)", async () => {
    const spineVersion = await seedFlag({ id: "FLY", level: "yellow", rule_id: "orphan_actor" });

    const { result } = renderHook(() => useFlags(P, spineVersion));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.flags).toHaveLength(1);
    expect(result.current.flags[0]).toMatchObject({ id: "FLY", waived_by_user: false });

    await result.current.waive("FLY", "Chấp nhận vì phạm vi MVP hiện tại");

    await waitFor(() => {
      expect(result.current.flags.find((f) => f.id === "FLY")?.waived_by_user).toBe(true);
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("waive luật cấm (array_empty) ném lỗi và set `error`, không cập nhật danh sách", async () => {
    const spineVersion = await seedFlag({ id: "FLX", level: "red", rule_id: "array_empty" });
    const { result } = renderHook(() => useFlags(P, spineVersion));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.waive("FLX", "Lý do đủ dài để vượt ngưỡng 20 ký tự")).rejects.toMatchObject({
      code: "FLAG_NOT_WAIVABLE",
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.flags.find((f) => f.id === "FLX")?.waived_by_user).toBe(false);
  });

  it("recompute() tải lại danh sách cờ từ BE", async () => {
    const spineVersion = await seedFlag({ id: "FLZ", level: "yellow", rule_id: "orphan_actor" });
    const { result } = renderHook(() => useFlags(P, spineVersion));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.recompute();

    expect(result.current.busy).toBe(false);
    expect(result.current.flags.some((f) => f.id === "FLZ")).toBe(true);
  });

  it("spineVersion = null: không gọi API, giữ danh sách rỗng", () => {
    const { result } = renderHook(() => useFlags(P, null));
    expect(result.current.flags).toEqual([]);
  });
});
