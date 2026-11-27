import { describe, expect, it } from "vitest";
import { diffWords, WORD_DIFF_MAX_TOKENS } from "./word-diff";

describe("diffWords", () => {
  it("chỉ tô chữ đổi, phần giống giữ nguyên", () => {
    expect(diffWords("khoá sau 5 lần trong 15 phút", "khoá sau 3 lần trong 10 phút")).toEqual([
      { op: "same", text: "khoá sau " },
      { op: "del", text: "5" },
      { op: "add", text: "3" },
      { op: "same", text: " lần trong " },
      { op: "del", text: "15" },
      { op: "add", text: "10" },
      { op: "same", text: " phút" },
    ]);
  });

  it("chèn chữ giữa đoạn ⇒ chỉ phần chèn là add", () => {
    expect(diffWords("gửi e-mail cho chủ", "gửi e-mail kèm link cho chủ")).toEqual([
      { op: "same", text: "gửi e-mail " },
      { op: "add", text: "kèm link " },
      { op: "same", text: "cho chủ" },
    ]);
  });

  it("giống hệt ⇒ một phần same; rỗng ⇒ []", () => {
    expect(diffWords("a b", "a b")).toEqual([{ op: "same", text: "a b" }]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("đoạn quá dài ⇒ cả đoạn cũ del, cả đoạn mới add", () => {
    const long = Array.from({ length: WORD_DIFF_MAX_TOKENS }, (_, i) => `w${i}`).join(" ");
    expect(diffWords(long, `${long} x`)).toEqual([
      { op: "del", text: long },
      { op: "add", text: `${long} x` },
    ]);
  });
});

describe("groupHunks - gom bỏ / thêm của một chỗ đổi", () => {
  it("bỏ / thêm xen kẽ từng từ ⇒ hết phần bỏ rồi hết phần thêm", async () => {
    const { groupHunks } = await import("./BlockDiff");
    const parts = groupHunks(diffWords("Đăng xuất khỏi trình duyệt hiện tại.", "Đăng xuất khỏi mọi thiết bị."));
    expect(parts.filter((p) => p.op !== "same").map((p) => `${p.op}:${p.text.trim()}`)).toEqual(["del:trình duyệt hiện tại", "add:mọi thiết bị"]);
  });
});

describe("diffWords - ưu tiên giữ chữ dài", () => {
  it("bỏ một mục trong liệt kê ⇒ “specifications” giữ nguyên, không vừa bỏ vừa thêm", () => {
    const parts = diffWords("price, stock, specifications and reviews.", "price, stock and specifications.");
    expect(parts.filter((p) => p.op === "same").map((p) => p.text).join("")).toContain("specifications");
    expect(parts.filter((p) => p.op !== "same").map((p) => p.text).join("")).not.toContain("specifications");
  });
});
