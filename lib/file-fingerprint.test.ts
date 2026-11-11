import { describe, expect, it } from "vitest";
import { fileFingerprint, splitDuplicateFiles } from "./file-fingerprint";

describe("FLF-398 — dấu nội dung file lúc chọn", () => {
  it("cùng nội dung (kể cả khác tên) ⇒ cùng dấu; khác nội dung ⇒ khác dấu", async () => {
    const a = await fileFingerprint(new File(["Biên bản họp 15/10"], "bien-ban.docx"));
    expect(await fileFingerprint(new File(["Biên bản họp 15/10"], "bien-ban (1).docx"))).toBe(a);
    expect(await fileFingerprint(new File(["Email khách"], "email.txt"))).not.toBe(a);
  });

  it("bỏ file trùng file đã có và trùng nhau trong cùng lượt chọn", async () => {
    const known = new Set([await fileFingerprint(new File(["cũ"], "cu.txt"))]);
    const files = [new File(["cũ"], "cu-copy.txt"), new File(["mới"], "moi.txt"), new File(["mới"], "moi (1).txt")];
    const { kept, duplicates } = await splitDuplicateFiles(files, known);
    expect(kept.map((k) => k.file.name)).toEqual(["moi.txt"]);
    expect(duplicates.map((f) => f.name)).toEqual(["cu-copy.txt", "moi (1).txt"]);
  });
});
