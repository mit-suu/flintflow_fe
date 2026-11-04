/**
 * Danh mục section template FPT để chọn khi xác nhận mapping heading (mode 1, UC-21) — bản sao chỉ đọc của
 * `FIXED_SECTIONS` (`flintflow_be/src/modules/spine/section-registry.ts`, hợp đồng đóng băng) và heading nhóm
 * của `import/section-catalog.ts`. Section feature/function có id tạm `feature:@B…` do BE sinh — lấy từ profile.
 */

import { createTranslator } from "next-intl";
import { currentLocale } from "@/lib/api/error-messages";
import { isContentSlot, slotKey } from "@/lib/constants/content-slots";
import type { Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

const MESSAGES = { vi, en } as const;

/**
 * Nhãn theo ngôn ngữ UI (`common.fptSections`). Component nên truyền `useLocale()` để nhãn đổi cùng lượt render
 * khi user đổi ngôn ngữ; không truyền ⇒ lấy ngôn ngữ đang hiển thị (`<html lang>`).
 */
const sectionT = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "common.fptSections" });

export interface FptSectionOption {
  id: string;
  number: string;
  title: string;
  /** Heading nhóm (`group:2`…) không có nội dung riêng, không trích. */
  group: boolean;
}

const fixed = (number: string, title: string): FptSectionOption => ({
  id: `fixed:${number}`,
  number,
  title,
  group: false,
});

const group = (number: string, title: string): FptSectionOption => ({
  id: `group:${number}`,
  number,
  title,
  group: true,
});

/** Theo thứ tự tài liệu. */
export const FPT_SECTIONS: readonly FptSectionOption[] = [
  fixed("I", "Record of Changes"),
  fixed("1", "Product Overview"),
  group("2", "User Requirements"),
  fixed("2.1", "Actors"),
  group("2.2", "Use Cases"),
  fixed("2.2.1", "Use Case Diagram"),
  fixed("2.2.2", "Use Case Descriptions"),
  group("3", "Functional Requirements"),
  group("3.1", "System Functional Overview"),
  fixed("3.1.1", "Screens Flow"),
  fixed("3.1.2", "Screen Descriptions"),
  fixed("3.1.3", "Screen Authorization"),
  fixed("3.1.4", "Non-Screen Functions"),
  fixed("3.1.5", "Entity Relationship Diagram"),
  group("4", "Non-Functional Requirements"),
  fixed("4.1", "External Interfaces"),
  group("4.2", "Quality Attributes"),
  fixed("4.2.1", "Usability"),
  fixed("4.2.2", "Reliability"),
  fixed("4.2.3", "Performance"),
  fixed("4.2.4", "Domain-Specific Attributes"),
  group("5", "Requirement Appendix"),
  fixed("5.1", "Business Rules"),
  fixed("5.2", "Common Requirements"),
  fixed("5.3", "Application Messages List"),
  fixed("5.4", "Other Requirements"),
  fixed("5.5", "Glossary"),
];

const PROVISIONAL = /^(feature|function):@(B\d{4,})$/;

const KIND = /^(feature|function|custom|group):(.+)$/;

/** Section tạm `feature:@B…` / `function:@B…` — tính năng / chức năng nhận từ heading của file, chưa có mã. */
export const isProvisionalSection = (id: string): boolean => PROVISIONAL.test(id);

/** Nhãn section tạm = đúng tiêu đề heading trong file (`3.2 Authentication`) — không thêm tiền tố "Tính năng mới —". */
export const provisionalLabel = (heading: string): string => heading.trim();

const OUTLINE = /^(\d+(?:\.\d+)*)(?=[.\s]|$)/;

/**
 * So sánh hai nhãn mục theo số đề mục ở đầu nhãn (`2.1 Actors` < `3.2 Authentication` < `3.10 …`), từng cấp theo số.
 * Nhãn không bắt đầu bằng số (`Mục riêng`, `Không khớp`…) xếp sau, giữ thứ tự cũ (dùng với `Array.prototype.sort` ổn định).
 */
export const compareOutlineLabels = (a: string, b: string): number => {
  const pa = OUTLINE.exec(a.trim())?.[1].split(".").map(Number);
  const pb = OUTLINE.exec(b.trim())?.[1].split(".").map(Number);
  if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
};

/**
 * Nhãn hiển thị của một section id — không bao giờ trả mã thô cho người dùng: `2.1 Actors`, `Tính năng mới (chưa có mã)`,
 * `Tính năng F2`, `Chức năng FN01`, `Mục riêng`, `Không khớp`. Section tạm có heading thì dùng `sectionLabelIn`.
 */
export const sectionLabel = (id: string | null, locale: Locale = currentLocale()): string => {
  const t = sectionT(locale);
  if (!id || id === "unmapped") return t("unmapped");
  const known = FPT_SECTIONS.find((s) => s.id === id);
  if (known) return `${known.number} ${known.title}`;
  // FLF-278: phần nhỏ `slot:*` của mẫu khách
  if (isContentSlot(id)) return t(`slots.${slotKey(id)}` as Parameters<typeof t>[0]);
  if (isProvisionalSection(id)) return t(id.startsWith("feature:") ? "newFeatureNoCode" : "newFunctionNoCode");
  const kind = KIND.exec(id);
  if (kind) {
    if (kind[1] === "custom") return t("custom");
    if (kind[1] === "group") return t("section", { number: kind[2] });
    return t(kind[1] === "feature" ? "feature" : "function", { code: kind[2] });
  }
  if (id.startsWith("fixed:")) return t("section", { number: id.slice("fixed:".length) });
  return id;
};

/** Số gõ tay ở đầu tiêu đề (`2.1 Actors`, `IV. NFR`) — cùng mẫu `splitHeadingNumber` của BE. */
const TYPED_NUMBER = /^\s*(?:(?:\d{1,2}\.)*\d{1,2}|[IVX]{1,4})\.?\s+\S/;

/**
 * Tiêu đề heading của file upload đúng như người dùng thấy trong Word (FLF-362): nhãn số Word tự đánh (`number_label`) +
 * chữ heading; chữ đã gõ số tay hoặc không có nhãn ⇒ giữ nguyên chữ.
 */
export const fileHeadingLabel = (heading: { heading_text: string; number_label?: string }): string => {
  const text = heading.heading_text.trim();
  const label = heading.number_label?.trim();
  return label && text && !TYPED_NUMBER.test(text) ? `${label} ${text}` : text;
};

type HeadingRef = { block_id: string; heading_text: string; section_id?: string; number_label?: string };

/**
 * Như `sectionLabel`, nhưng lấy tiêu đề **của file upload** (`heading_map` của profile) — kèm đúng số của file (FLF-362):
 * section tạm theo heading sinh ra nó, section khác theo heading đầu tiên map vào nó. Section không có heading trong file
 * (mục FPT FlintFlow thêm) ⇒ nhãn mẫu như `sectionLabel`.
 */
export const sectionLabelIn = (id: string | null, headingMap?: readonly HeadingRef[], locale: Locale = currentLocale()): string => {
  const block = id && isProvisionalSection(id) ? id.slice(id.indexOf("@") + 1) : null;
  const heading = id ? headingMap?.find((h) => (block ? h.block_id === block : h.section_id === id)) : undefined;
  return heading?.heading_text.trim() ? provisionalLabel(fileHeadingLabel(heading)) : sectionLabel(id, locale);
};
