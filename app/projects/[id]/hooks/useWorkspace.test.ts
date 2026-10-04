import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { useWorkspace } from "./useWorkspace";

/**
 * FLF-249 — thẻ cổng chốt dựng từ lượt chạy đang sống nên chốt xong là biến mất. Tin cổng phải ở lại khung chat
 * ngay trước thao tác vừa bấm; lượt chốt không thành thì gỡ cả hai, không để tin "ma".
 */
beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => resetMockState());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const loaded = async () => {
  const hook = renderHook(() => useWorkspace(MOCK_PROJECT_ID));
  await waitFor(() => expect(hook.result.current.activeSession).not.toBeNull());
  return hook;
};

describe("useWorkspace — tin hiện tạm của lượt chốt cổng", () => {
  it("giữ đúng thứ tự tin cổng của AI rồi tới thao tác của user", async () => {
    const { result } = await loaded();
    const before = result.current.activeSession!.messages.length;

    act(() => {
      result.current.appendLocalMessage("Tôi đã ghi ba nhóm người dùng.", "S-3.1", "ai");
      result.current.appendLocalMessage("Đúng rồi, đi tiếp", "S-3.1");
    });

    const added = result.current.activeSession!.messages.slice(before);
    expect(added.map((m) => [m.role, m.content])).toEqual([
      ["ai", "Tôi đã ghi ba nhóm người dùng."],
      ["user", "Đúng rồi, đi tiếp"]
    ]);
  });

  it("gỡ được tin AI, không chỉ tin user — lượt chốt hỏng thì không còn tin cổng treo lại", async () => {
    const { result } = await loaded();
    const before = result.current.activeSession!.messages.length;

    act(() => {
      result.current.appendLocalMessage("Tin cổng", "S-3.1", "ai");
      result.current.appendLocalMessage("Đúng rồi, đi tiếp", "S-3.1");
    });
    act(() => {
      result.current.dropLocalMessage("Đúng rồi, đi tiếp");
      result.current.dropLocalMessage("Tin cổng", "ai");
    });

    expect(result.current.activeSession!.messages).toHaveLength(before);
  });

  it("gỡ mặc định chỉ chạm tin user: cùng nội dung ở hai vai thì tin AI ở lại", async () => {
    const { result } = await loaded();
    const before = result.current.activeSession!.messages.length;

    act(() => {
      result.current.appendLocalMessage("cùng một câu", "S-3.1", "ai");
      result.current.appendLocalMessage("cùng một câu", "S-3.1");
    });
    act(() => result.current.dropLocalMessage("cùng một câu"));

    const added = result.current.activeSession!.messages.slice(before);
    expect(added.map((m) => m.role)).toEqual(["ai"]);
  });
});
