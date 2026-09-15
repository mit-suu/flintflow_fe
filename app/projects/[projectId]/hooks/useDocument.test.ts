import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assembleDocument } from "@/lib/api/export";
import { getSpine } from "@/lib/api/spine";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { useDocument } from "./useDocument";

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

describe("useDocument", () => {
  it("chưa assemble ⇒ notAssembled = true, document = null, loading kết thúc", async () => {
    const { result } = renderHook(() => useDocument(P, "draft"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notAssembled).toBe(true);
    expect(result.current.document).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it("đã assemble ⇒ tải được document + meta; reload() đặt lại loading rồi tải lại", async () => {
    await assembleDocument(P, await version());
    const { result } = renderHook(() => useDocument(P, "draft"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notAssembled).toBe(false);
    expect(result.current.document?.sections.length).toBeGreaterThan(0);
    expect(result.current.meta?.stale).toBe(false);

    await result.current.reload();
    expect(result.current.loading).toBe(false);
    expect(result.current.document?.sections.length).toBeGreaterThan(0);
  });

  it("refreshToken tăng ⇒ tải lại tự động (không cần gọi reload tay)", async () => {
    const { result, rerender } = renderHook(({ token }) => useDocument(P, "draft", undefined, token), {
      initialProps: { token: 0 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notAssembled).toBe(true);

    await assembleDocument(P, await version());
    rerender({ token: 1 });

    await waitFor(() => expect(result.current.notAssembled).toBe(false));
    expect(result.current.document?.sections.length).toBeGreaterThan(0);
  });
});
