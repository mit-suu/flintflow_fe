import { describe, expect, it } from "vitest";
import { blocksToText, textToBlocks } from "./content-text";

describe("content-text", () => {
  it("đoạn cách dòng trống, gạch đầu dòng liền nhau vẫn tách; hai chiều khớp", () => {
    const blocks = textToBlocks("Terms in bold.\nSecond line.\n\n- IEEE 830\n- ISO 25010\n\nClosing note.");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Terms in bold. Second line." },
      { kind: "list_item", text: "IEEE 830" },
      { kind: "list_item", text: "ISO 25010" },
      { kind: "paragraph", text: "Closing note." },
    ]);
    const full = blocks.map((b) => ({ ...b, rows: null, image_ref: null }));
    expect(textToBlocks(blocksToText(full))).toEqual(blocks);
    expect(textToBlocks("  \n\n ")).toEqual([]);
  });
});
