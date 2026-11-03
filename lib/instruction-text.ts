import type { Block, InlineRun } from "@/types/document";

/**
 * Chữ hướng dẫn của mẫu SRS (FLF-278) — ĐỒNG BỘ TAY với BE `shared/utils/instruction-text.ts`: đoạn nằm trọn trong ngoặc
 * (`[Describe …]`, `<<…>>`, `{…}`, `(…)`) hoặc câu "This section describes…" / "Mục này mô tả…". Không phải nội dung tài liệu:
 * BE không tính nó khi xét mục trống (cờ `template_section_empty`, thư viện tổ chức), FE cũng phải coi như vậy.
 */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /^[[<{(][\s\S]*[\]>})]$/,
  /^(this|the) section (describes|should|lists|contains)/i,
  /^(mục|phần) này (mô tả|trình bày|liệt kê|nêu)/i,
];

export const isInstructionText = (text: string): boolean => {
  const t = text.trim();
  return t.length > 0 && INSTRUCTION_PATTERNS.some((re) => re.test(t));
};

/** Chữ có nghĩa: không rỗng và không phải chữ hướng dẫn / ô chỗ trống (`[Name]`, `[dd/mm/yyyy]`). */
export const isRealText = (text: string | null | undefined): boolean => !!text && text.trim().length > 0 && !isInstructionText(text);

const runsText = (runs: readonly InlineRun[]): string => runs.map((r) => r.text).join("");

/** Block có nội dung thật — ảnh luôn tính; bảng chỉ tính khi có ô (kể cả tiêu đề) mang chữ thật. */
export const blockHasRealText = (block: Block): boolean => {
  switch (block.type) {
    case "paragraph":
      return isRealText(runsText(block.runs));
    case "heading":
      return isRealText(block.text);
    case "bullet_list":
    case "numbered_list":
      return block.items.some((item) => isRealText(runsText(item)));
    case "table":
      return [block.header, ...block.rows].some((row) => row.some((cell) => isRealText(runsText(cell))));
    case "image":
      return true;
    default:
      return false;
  }
};
