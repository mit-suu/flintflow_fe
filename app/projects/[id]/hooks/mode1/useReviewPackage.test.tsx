import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getReviewPackage = vi.fn();
vi.mock("@/lib/api/versions", () => ({ getReviewPackage: (...a: unknown[]) => getReviewPackage(...a) }));

import { emitNotificationsChanged } from "@/lib/api/notifications";
import { useReviewPackage } from "./useReviewPackage";

describe("useReviewPackage (FLF-480 ChoViet #15)", () => {
  beforeEach(() => getReviewPackage.mockReset());

  it("đọc lại khi cửa sổ được focus và khi thông báo đổi: Lead phát hành ở cửa sổ khác ⇒ pill hết kẹt", async () => {
    getReviewPackage.mockResolvedValueOnce({ data: { status: "submitted" } }).mockResolvedValue({ data: null });
    const { result } = renderHook(() => useReviewPackage("p1", true));
    await waitFor(() => expect(result.current).toEqual({ status: "submitted" }));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current).toBeNull());
    expect(getReviewPackage).toHaveBeenCalledTimes(2);
    act(() => emitNotificationsChanged());
    await waitFor(() => expect(getReviewPackage).toHaveBeenCalledTimes(3));
  });

  it("enabled = false ⇒ không gọi", () => {
    renderHook(() => useReviewPackage("p1", false));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(getReviewPackage).not.toHaveBeenCalled();
  });
});
