import { describe, expect, it } from "vitest";
import { isSignedVersion } from "../DocumentPane";

describe("FLF-431 isSignedVersion", () => {
  it("bản làm việc trùng số một baseline đã ký ⇒ là bản đã ký (bỏ tiền tố v)", () => {
    expect(isSignedVersion("v1.0", ["v1.0"])).toBe(true);
    expect(isSignedVersion("1.0", ["v1.0"])).toBe(true);
    expect(isSignedVersion("v1.1", ["v1.0"])).toBe(false);
    expect(isSignedVersion("v0.3", [])).toBe(false);
    expect(isSignedVersion(undefined, ["v1.0"])).toBe(false);
  });
});
