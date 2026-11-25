import { describe, expect, it } from "vitest";
import { describeChange } from "./describe-change";

describe("describeChange FLF-486 A3", () => {
  it("câu thêm cuối đoạn dài vẫn hiện sau mũi tên", () => {
    const A = Array.from({ length: 30 }, (_, i) => `tu${i}`).join(" ");
    const text = describeChange({ op: "set", path: "project.vision", before: A, value: `${A} Phiên bản 1.0 gồm 15 use case.` });
    expect(text.split("→")[1]).toContain("15 use case");
  });
  it("đổi tên ngắn giữ nguyên, không có …", () => {
    const text = describeChange({ op: "set", path: "actors[id=A03].name", before: "Admin", value: "Administrator" });
    expect(text).toContain("Admin → Administrator");
    expect(text).not.toContain("…");
  });
});
