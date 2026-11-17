import type { Block, InlineRun } from "@/types/document";

/**
 * Chữ hướng dẫn của mẫu SRS (FLF-278, FLF-364) — ĐỒNG BỘ TAY với BE `shared/utils/instruction-text.ts`: **chỉ** đoạn nằm trọn
 * trong `[ ]` hoặc `{ }` (`[Describe …]`, `{Ghi chú…}`, `[Name]`, `{{project name}}`). Ngoặc tròn, `< >`, câu "This section
 * describes…" là nội dung. Không phải nội dung tài liệu: BE không tính nó khi xét mục trống (cờ `template_section_empty`,
 * thư viện tổ chức), FE cũng phải coi như vậy.
 */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [/^\[[\s\S]*\]$/, /^\{[\s\S]*\}$/];

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

/** Dòng chỉ có dấu chấm lửng / chấm (`…`, `...`) — chỗ trống "còn nữa" của mẫu, không phải nội dung. */
const isEllipsis = (text: string): boolean => /^[.…\s]+$/.test(text) && text.trim().length > 0;

/** Khối chữ hướng dẫn của mẫu: đoạn / danh sách chỉ có chữ trong ngoặc hoặc dấu chấm lửng. */
const isGuidanceBlock = (block: Block): boolean => {
  if (block.type === "paragraph") return !blockHasRealText(block) || isEllipsis(runsText(block.runs));
  if (block.type === "bullet_list" || block.type === "numbered_list") return block.items.every((item) => !isRealText(runsText(item)) || isEllipsis(runsText(item)));
  return false;
};

/**
 * P07 (câu 3, chốt 17/11): mục chưa soạn mà BE in chữ hướng dẫn của mẫu (FLF-364 câu 10) — màn Xem hiện "Chưa soạn" như mục
 * trống, chữ hướng dẫn mờ bên dưới (bản Word không in hướng dẫn). Mục không có khối nào không tính ở đây.
 */
export const isGuidanceOnly = (blocks: readonly Block[]): boolean => blocks.length > 0 && blocks.every(isGuidanceBlock);
