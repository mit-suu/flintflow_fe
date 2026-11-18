import { FPT_SECTIONS } from "@/lib/constants/fpt-sections";
import type { Locale } from "@/lib/i18n";

/**
 * Tên mục để hiển thị từ `section_id` (`fixed:2.1`, `group:3`, `custom:…`, `feature:…`). Mục FPT lấy số + tên trong
 * `FPT_SECTIONS`; mục khác trả lại phần sau dấu `:` — đủ để người dùng nhận ra, không gọi API.
 */
export const sectionTitleOf = (sectionId: string, _locale?: Locale): string => {
  const known = FPT_SECTIONS.find((s) => s.id === sectionId);
  if (known) return `${known.number} ${known.title}`;
  const idx = sectionId.indexOf(":");
  return idx >= 0 ? sectionId.slice(idx + 1) : sectionId;
};
