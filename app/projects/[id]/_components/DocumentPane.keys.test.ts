import { describe, expect, it } from "vitest";
import { sectionRenderKeys } from "./DocumentPane";

describe("sectionRenderKeys", () => {
  it("mục cùng section_id (mẫu có nhiều heading cùng mục) ⇒ key không trùng; mục không lặp giữ key là id", () => {
    expect(sectionRenderKeys([{ id: "fixed:4" }, { id: "fixed:4.1" }, { id: "fixed:4.1" }, { id: "fixed:4.1" }, { id: "fixed:5.4" }])).toEqual([
      "fixed:4",
      "fixed:4.1",
      "fixed:4.1#1",
      "fixed:4.1#2",
      "fixed:5.4",
    ]);
  });
});
