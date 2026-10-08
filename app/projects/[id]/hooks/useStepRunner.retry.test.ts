/**
 * L11 — `base_version` của FE đi sau BE mà KHÔNG phải vì ai đó sửa tài liệu: lượt chạy trước còn render diagram
 * và recompute cờ sau `ops_applied`, waive cờ / bật tắt step cũng tăng version. Hook phải tự đọc lại version rồi
 * chạy lại một lần thay vì ném 409 vào mặt người dùng (trước đây phải F5 mới chạy tiếp được).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSpine } from "@/lib/api/spine";
import { mockTiming } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, MOCK_SESSION_ID, resetMockState } from "@/mocks/state";
import { useStepRunner } from "./useStepRunner";

const P = MOCK_PROJECT_ID;
// Step tất định: mock không hỏi elicit, không draft ⇒ chạy thẳng tới gate_ready, test không phải trả lời câu hỏi.
const STEP = "S-9.1";

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => resetMockState());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

/** `getBaseVersion` trả version FE đang giữ; `onSpineChanged` cập nhật nó như `page.tsx` làm thật. */
const setup = (startVersion: number) => {
  let version = startVersion;
  const onSpineChanged = vi.fn((v?: number) => {
    if (v !== undefined && v > version) version = v;
  });
  const hook = renderHook(() =>
    useStepRunner({
      projectId: P,
      sessionId: MOCK_SESSION_ID,
      getBaseVersion: () => version,
      onSpineChanged,
    })
  );
  return { hook, onSpineChanged, versionSeen: () => version };
};

describe("useStepRunner — lệch version (L11)", () => {
  it("base_version cũ ⇒ đọc lại Spine rồi chạy lại, không báo lỗi cho người dùng", async () => {
    const real = (await getSpine(P)).data!.spine_version;
    const { hook, versionSeen } = setup(real - 1); // FE tụt lại một nhịp

    await act(async () => {
      await hook.result.current.run(STEP);
    });

    await waitFor(() => expect(hook.result.current.state.status).toBe("gate_ready"));
    expect(hook.result.current.state.error, "409 phải được nuốt bằng một lượt thử lại").toBeNull();
    expect(versionSeen(), "version đã được kéo lên bằng BE").toBeGreaterThanOrEqual(real);
  });

  it("gate_ready mang spine_version cuối ⇒ FE nhận luôn, không chờ GET /spine", async () => {
    const real = (await getSpine(P)).data!.spine_version;
    const { hook, onSpineChanged } = setup(real);

    await act(async () => {
      await hook.result.current.run(STEP);
    });
    await waitFor(() => expect(hook.result.current.state.status).toBe("gate_ready"));

    const fromGate = onSpineChanged.mock.calls.at(-1)?.[0];
    expect(fromGate, "gate_ready phải truyền version, không gọi rỗng").toBeTypeOf("number");
    expect(fromGate).toBe((await getSpine(P)).data!.spine_version);
  });

  it("lệch thật (lần hai vẫn 409) ⇒ chịu thua và báo lỗi, không lặp vô hạn", async () => {
    const spineCalls = { n: 0 };
    // `getSpine` trả version sai mãi ⇒ lượt thử lại cũng 409; hook chỉ được thử đúng một lần.
    const spy = vi.spyOn(await import("@/lib/api/spine"), "getSpine").mockImplementation(async () => {
      spineCalls.n += 1;
      return { data: { spine_version: 999_999 }, error: null } as Awaited<ReturnType<typeof getSpine>>;
    });

    const { hook } = setup(1);
    await act(async () => {
      await hook.result.current.run(STEP);
    });
    await waitFor(() => expect(hook.result.current.state.status).toBe("error"));
    expect(hook.result.current.state.error?.code).toBe("SPINE_VERSION_CONFLICT");
    expect(spineCalls.n, "chỉ thử lại một lần").toBe(1);
    spy.mockRestore();
  });
});
