import type { Block, RenderedDocument, RenderedSection } from "@/types/document";

/**
 * So bản tài liệu mới với bản đang hiển thị — thuần FE, không đổi API. Kết quả dùng để tô đúng mục / đúng đoạn vừa đổi.
 *
 * - So theo `section.id` (không theo thứ tự): chèn một mục giữa tài liệu không làm mọi mục sau thành "đổi".
 * - Số mục (`number`) và `status` không tính là nội dung: đánh số lại hay đổi nhãn trạng thái không làm mục sáng lên.
 * - Trong một mục, dãy block so bằng khoá nội dung theo LCS ⇒ chèn / sửa một đoạn chỉ đánh dấu đoạn đó.
 */

export type SectionChange = "changed" | "added";

export interface DocumentDiff {
  /** Mục có nội dung đổi (`changed`) hoặc mới có (`added`). Mục bị xoá không còn chỗ để tô nên bỏ qua. */
  sections: Map<string, SectionChange>;
  /**
   * Chỉ số block (trong bản MỚI) đã đổi, theo mục. Chỉ có mục ở đây khi đổi gói trong MỘT PHẦN các block và tiêu đề mục giữ
   * nguyên — khi đó chỉ tô các block này. Không có mục ⇒ tô cả mục.
   */
  blocks: Map<string, Set<number>>;
  /**
   * Đổi quá nửa tài liệu (vd BE đổi định dạng chung): tô từng mục chỉ gây nhiễu ⇒ nơi hiển thị chỉ báo một nhãn chung và
   * `regions` rỗng.
   */
  broad: boolean;
  /** Các vùng cần tô theo thứ tự đọc: khoá `sectionRegionKey` hoặc `blockRegionKey`. Rỗng khi `broad`. */
  regions: string[];
}

export const sectionRegionKey = (sectionId: string): string => `section:${sectionId}`;
export const blockRegionKey = (sectionId: string, index: number): string => `block:${sectionId}#${index}`;

/** Quá ngưỡng này (và tài liệu đủ lớn để tỉ lệ có nghĩa) thì coi là đổi diện rộng. */
const BROAD_RATIO = 0.5;
const BROAD_MIN_SECTIONS = 4;
/** Ma trận LCS lớn hơn mức này (số ô) thì không tính nữa mà coi cả đoạn giữa là đổi — chặn CPU trên mục khổng lồ. */
const MAX_LCS_CELLS = 4_000_000;

const SAMPLES = 8;
const SAMPLE_LENGTH = 16;
const EDGE_LENGTH = 32;

/** Dấu vân tay rẻ của chuỗi base64 rất dài: độ dài + đầu/cuối + vài đoạn rải đều (đầu/cuối PNG gần như cố định). */
const fingerprint = (value: string): string => {
  const { length } = value;
  const samples: string[] = [];
  for (let i = 1; i <= SAMPLES; i++) {
    const at = Math.floor((length * i) / (SAMPLES + 1));
    samples.push(value.slice(at, at + SAMPLE_LENGTH));
  }
  return `b64:${length}:${value.slice(0, EDGE_LENGTH)}:${samples.join("")}:${value.slice(-EDGE_LENGTH)}`;
};

/**
 * Khoá so sánh của một block ảnh — KHÔNG stringify cả `png`:
 * - chuỗi tham chiếu (`diagram-ref:<id>` hay `diagram-ref:<id>@<hash>`, `diagram-error:<id>`) dùng nguyên;
 * - tham chiếu dạng object `{ ref, id, locale?, hash }` dùng id + hash (+ locale);
 * - base64 thật (vài trăm KB) dùng dấu vân tay.
 */
export const imageKey = (png: unknown): string => {
  if (typeof png === "string") {
    return png.startsWith("diagram-ref:") || png.startsWith("diagram-error:") ? png : fingerprint(png);
  }
  if (png && typeof png === "object") {
    const ref = png as { ref?: unknown; id?: unknown; locale?: unknown; hash?: unknown };
    if (typeof ref.hash === "string") return `ref:${String(ref.id ?? ref.ref ?? "")}@${ref.hash}${typeof ref.locale === "string" ? `:${ref.locale}` : ""}`;
    return `ref:${JSON.stringify(png)}`;
  }
  return `img:${String(png)}`;
};

export const blockKey = (block: Block): string => {
  if (block.type === "image") return `image|${imageKey(block.png as unknown)}|${block.caption ?? ""}`;
  return JSON.stringify(block);
};

/** Chỉ số trong `next` không thuộc dãy con chung dài nhất với `prev`. */
const changedIndexes = (prev: readonly string[], next: readonly string[]): Set<number> => {
  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) head++;
  let tail = 0;
  while (tail < prev.length - head && tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;

  const a = prev.slice(head, prev.length - tail);
  const b = next.slice(head, next.length - tail);
  const changed = new Set<number>();
  if (b.length === 0) return changed;
  if (a.length === 0 || a.length * b.length > MAX_LCS_CELLS) {
    for (let j = 0; j < b.length; j++) changed.add(head + j);
    return changed;
  }

  // lcs[i][j] = độ dài LCS của a[i..] và b[j..]
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < a.length && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      i++;
    } else {
      changed.add(head + j);
      j++;
    }
  }
  return changed;
};

const sectionKeys = (section: RenderedSection): string[] => section.blocks.map(blockKey);

/** So `prev` → `next`. Không có gì đổi ⇒ `sections` rỗng. */
export function diffDocument(prev: RenderedDocument, next: RenderedDocument): DocumentDiff {
  const before = new Map(prev.sections.map((section) => [section.id, section]));
  const sections = new Map<string, SectionChange>();
  const blocks = new Map<string, Set<number>>();

  for (const section of next.sections) {
    const old = before.get(section.id);
    if (!old) {
      sections.set(section.id, "added");
      continue;
    }
    const oldKeys = sectionKeys(old);
    const newKeys = sectionKeys(section);
    const sameBlocks = oldKeys.length === newKeys.length && oldKeys.every((key, i) => key === newKeys[i]);
    const sameHeading = old.heading === section.heading;
    if (sameBlocks && sameHeading) continue;
    sections.set(section.id, "changed");
    if (!sameHeading || sameBlocks) continue;
    const changed = changedIndexes(oldKeys, newKeys);
    // Chỉ xoá bớt (không có block nào mới) hoặc đổi cả mục ⇒ tô cả mục, không tô block nào
    if (changed.size > 0 && changed.size < section.blocks.length) blocks.set(section.id, changed);
  }

  const broad = next.sections.length >= BROAD_MIN_SECTIONS && sections.size > next.sections.length * BROAD_RATIO;
  const regions: string[] = [];
  if (!broad) {
    for (const section of next.sections) {
      if (!sections.has(section.id)) continue;
      const partial = blocks.get(section.id);
      if (partial) [...partial].sort((x, y) => x - y).forEach((index) => regions.push(blockRegionKey(section.id, index)));
      else regions.push(sectionRegionKey(section.id));
    }
  }
  return { sections, blocks, broad, regions };
}
