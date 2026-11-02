import { describe, expect, it } from "vitest";
import { blockHasRealText, isInstructionText, isRealText } from "./instruction-text";

const p = (text: string) => ({ type: "paragraph" as const, runs: [{ text }] });

describe("chữ hướng dẫn của mẫu (FLF-278, đồng bộ BE instruction-text)", () => {
  it("nhận chữ trong ngoặc và câu mô tả mục là hướng dẫn", () => {
    expect(isInstructionText("[Describe any standards or typographical conventions]")).toBe(true);
    expect(isInstructionText("  <<Tên hệ thống>> ")).toBe(true);
    expect(isInstructionText("This section describes the context of the product.")).toBe(true);
    expect(isInstructionText("Mục này mô tả phạm vi phát hành.")).toBe(true);
    expect(isInstructionText("Lumen Pay follows the internal IT security policy.")).toBe(false);
    expect(isRealText("   ")).toBe(false);
    expect(isRealText("[dd/mm/yyyy]")).toBe(false);
  });

  it("block chỉ có chữ hướng dẫn / ô chỗ trống không phải nội dung; ảnh luôn là nội dung", () => {
    expect(blockHasRealText(p("[List any other documents]"))).toBe(false);
    expect(blockHasRealText(p("Data is kept for 10 years."))).toBe(true);
    expect(blockHasRealText({ type: "bullet_list", items: [[{ text: "[Item]" }], [{ text: "QR payment" }]] })).toBe(true);
    expect(blockHasRealText({ type: "table", header: [[{ text: "[Name]" }]], rows: [[[{ text: "[Role]" }]]] })).toBe(false);
    expect(blockHasRealText({ type: "image", png: "x" })).toBe(true);
    expect(blockHasRealText({ type: "page_break" })).toBe(false);
  });
});
