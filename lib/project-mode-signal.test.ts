import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { onProjectModeMaybeChanged, signalProjectModeMaybeChanged } from "./project-mode-signal";

describe("project-mode-signal (FLF-318)", () => {
  const off: Array<() => void> = [];
  afterEach(() => off.splice(0).forEach((f) => f()));

  it("người nghe nhận tín hiệu; huỷ rồi thì thôi", () => {
    const listener = vi.fn();
    const stop = onProjectModeMaybeChanged(listener);
    signalProjectModeMaybeChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    signalProjectModeMaybeChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("lỗi chỉ mode 1 có (MODE1_NO_STEPS, CHANGE_REQUIRES_CR, PROJECT_MODE_MISMATCH) ⇒ phát tín hiệu; lỗi khác thì không", () => {
    const listener = vi.fn();
    off.push(onProjectModeMaybeChanged(listener));
    for (const code of ["MODE1_NO_STEPS", "CHANGE_REQUIRES_CR", "PROJECT_MODE_MISMATCH"]) new ApiClientError(409, code, "x");
    expect(listener).toHaveBeenCalledTimes(3);
    new ApiClientError(409, "SPINE_VERSION_CONFLICT", "x");
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
