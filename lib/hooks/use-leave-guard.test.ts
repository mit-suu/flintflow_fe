import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLeaveGuard } from "./use-leave-guard";

const fireBeforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("useLeaveGuard", () => {
  it("chỉ chặn rời trang khi active; tắt active hoặc unmount thì thôi chặn", () => {
    const { rerender, unmount } = renderHook(({ active }) => useLeaveGuard(active), { initialProps: { active: false } });
    expect(fireBeforeUnload()).toBe(false);

    rerender({ active: true });
    expect(fireBeforeUnload()).toBe(true);

    rerender({ active: false });
    expect(fireBeforeUnload()).toBe(false);

    rerender({ active: true });
    unmount();
    expect(fireBeforeUnload()).toBe(false);
  });
});
