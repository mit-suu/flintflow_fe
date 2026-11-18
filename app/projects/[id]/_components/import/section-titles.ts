/**
 * Tên mục hiển thị ở màn đọc file. FLF-411 U3-3: không bao giờ in mã mục (`custom:CS02`, `fixed:2.1`, `@B1023`) — tiêu đề rỗng
 * hoặc trông như mã ⇒ nhãn trung tính theo loại mục ("Mục riêng của file", "2.1 Actors").
 */
import { sectionLabel } from "@/lib/constants/fpt-sections";
import type { Locale } from "@/lib/i18n";

const looksLikeCode = (text: string) => /^[a-z_]+:\S+$/.test(text.trim()) || /^@?B\d+$/.test(text.trim());

export const importSectionTitle = (sectionId: string, title: string | null | undefined, locale: Locale): string => {
  const clean = (title ?? "").trim();
  if (clean && clean !== sectionId && !looksLikeCode(clean)) return clean;
  const label = sectionLabel(sectionId.includes("@") && !/^(feature|function):/.test(sectionId) ? "custom:x" : sectionId, locale);
  return looksLikeCode(label) ? sectionLabel("custom:x", locale) : label;
};

/**
 * FLF-411 U-1 / #14: mục ở màn đọc nội dung xếp theo thứ tự trong file (thứ tự `heading_map`), như màn đọc khung — không để mục
 * nhóm (tính năng) BE đọc trước đứng lên đầu. Mục không tìm thấy heading giữ thứ tự cũ, xếp sau.
 */
export const sortByFileOrder = <T extends { section_id: string }>(sections: readonly T[], headings: readonly { block_id: string; section_id: string }[] | undefined): T[] => {
  const pos = new Map<string, number>();
  (headings ?? []).forEach((h, i) => {
    if (!pos.has(h.block_id)) pos.set(h.block_id, i);
    if (!pos.has(h.section_id)) pos.set(h.section_id, i);
  });
  const posOf = (id: string) => (id.includes("@") ? pos.get(id.slice(id.lastIndexOf("@") + 1)) : pos.get(id)) ?? Number.MAX_SAFE_INTEGER;
  return sections
    .map((s, i) => ({ s, i, p: posOf(s.section_id) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.s);
};
