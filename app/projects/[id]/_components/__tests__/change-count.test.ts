import { describe, expect, it } from "vitest";
import { contentChangeCount } from "../change-count";

describe("FLF-431 contentChangeCount", () => {
  it("bỏ op ghi mốc duyệt / cờ / sơ đồ, chỉ đếm nội dung", () => {
    expect(
      contentChangeCount([
        { path: "steps[id=S-3.2].last_seq" },
        { path: "steps[id=S-3.2].accepted_at" },
        { path: "diagrams[id=D01]" },
        { path: "use_cases[id=UC01].description" },
        { path: "project.vision" },
      ])
    ).toBe(2);
    expect(contentChangeCount([{ path: "steps[id=S-5.2@S01].accepted_at" }])).toBe(0);
  });
});
