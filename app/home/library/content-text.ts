import type { ContentEntryInput } from "@/types/org-library";
import type { CustomBlock } from "@/types/spine";

/**
 * Soạn nội dung thư viện bằng một ô chữ: đoạn cách nhau bởi dòng trống, dòng bắt đầu bằng "- " là gạch đầu dòng.
 * Hai chiều khớp nhau để sửa một mục không làm đổi các đoạn khác.
 */
export const blocksToText = (blocks: readonly CustomBlock[]): string =>
  blocks
    .filter((b) => b.kind === "paragraph" || b.kind === "list_item")
    .map((b) => (b.kind === "list_item" ? `- ${b.text}` : b.text))
    .join("\n\n");

export const textToBlocks = (text: string): ContentEntryInput["blocks"] =>
  text
    .split(/\n\s*\n|\n(?=\s*[-•]\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bullet = /^[-•]\s+([\s\S]*)$/.exec(part);
      return bullet ? { kind: "list_item" as const, text: bullet[1].replace(/\s*\n\s*/g, " ").trim() } : { kind: "paragraph" as const, text: part.replace(/\s*\n\s*/g, " ") };
    })
    .filter((b) => b.text.length > 0);
