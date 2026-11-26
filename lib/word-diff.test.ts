import { describe, expect, it } from "vitest";
import { clipPair, diffTokens, focusTokens } from "./word-diff";

const base = Array.from({ length: 40 }, (_, i) => `tu${i}`).join(" ");

describe("focusTokens", () => {
  it("câu thêm cuối đoạn dài: đầu là …, giữ đúng token ins, bỏ phần xa", () => {
    const out = focusTokens(diffTokens(base, `${base} Phiên bản 1.0 gồm 15 use case.`), 6);
    expect(out[0]).toEqual({ text: "…", kind: "same" });
    expect(out.filter((t) => t.kind === "ins").map((t) => t.text).join(" ")).toBe("Phiên bản 1.0 gồm 15 use case.");
    expect(out.filter((t) => t.kind === "same" && t.text !== "…")).toHaveLength(6);
    expect(out.some((t) => t.text === "tu0")).toBe(false);
  });
  it("không có thay đổi: trả nguyên", () => {
    const tokens = diffTokens(base, base);
    expect(focusTokens(tokens)).toBe(tokens);
  });
});

describe("clipPair", () => {
  it("hai chuỗi ngắn: trả nguyên", () => {
    expect(clipPair("Admin", "Administrator", 60)).toEqual({ before: "Admin", after: "Administrator" });
  });
  it("hai chuỗi 300 ký tự chỉ khác ở cuối: thấy phần khác", () => {
    const a = "lorem ipsum dolor ".repeat(17).trim();
    const r = clipPair(a, `${a} Phiên bản 1.0 gồm 15 use case.`, 60);
    expect(r.before).not.toBe(r.after);
    expect(r.after).toContain("15 use case");
    expect(r.before.startsWith("…")).toBe(true);
    expect(r.after.startsWith("…")).toBe(true);
  });
});
