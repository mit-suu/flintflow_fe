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
const TYPED_NUMBER = /^\s*(?:(?:\d{1,2}\.)*\d{1,2}|[IVX]{1,4})\.?\s+(?=\S)/;

/** Tiêu đề bỏ số mục gõ tay ở đầu (FLF-362): "1. Giới thiệu" ⇒ "Giới thiệu", "3.2.1 UC-01 …" ⇒ "UC-01 …". */
export const plainHeading = (text: string): string => text.trim().replace(TYPED_NUMBER, "");

type HeadingRef = { block_id: string; heading_text: string; section_id?: string };

/** Heading của file upload sinh ra section: section tạm theo block của nó, section khác theo heading đầu tiên map vào nó. */
const fileHeadingOf = (id: string | null, headingMap?: readonly HeadingRef[]): { index: number; heading?: HeadingRef } => {
  const block = id && isProvisionalSection(id) ? id.slice(id.indexOf("@") + 1) : null;
  const index = id && headingMap ? headingMap.findIndex((h) => (block ? h.block_id === block : h.section_id === id)) : -1;
  return { index, heading: index >= 0 ? headingMap![index] : undefined };
};

/**
 * Nhãn mục trên màn luồng upload (FLF-362, bước 3 "Đọc file & tạo bản gốc"): tiêu đề **của file upload** bỏ số mục — số gõ
 * tay lẫn số Word tự đánh, cả khung FPT lẫn IEEE. Section không có heading trong file ⇒ tên mẫu FPT không số; section khác
 * ⇒ như `sectionLabel`.
 */
export const sectionLabelIn = (id: string | null, headingMap?: readonly HeadingRef[], locale: Locale = currentLocale()): string => {
  const { heading } = fileHeadingOf(id, headingMap);
  if (heading?.heading_text.trim()) return provisionalLabel(plainHeading(heading.heading_text));
  const known = FPT_SECTIONS.find((s) => s.id === id);
  return known ? known.title : sectionLabel(id, locale);
};

/**
 * So thứ tự hai section trên màn luồng upload (FLF-362) — theo thứ tự heading trong file (nhãn đã bỏ số nên không xếp theo
 * số được); section không có trong file xếp sau, theo thứ tự mẫu FPT.
 */
export const compareFileOrder = (headingMap?: readonly HeadingRef[]) => {
  const fptIndex = (id: string) => {
    const i = FPT_SECTIONS.findIndex((s) => s.id === id);
    return i >= 0 ? i : FPT_SECTIONS.length;
  };
  return (a: string, b: string): number => {
    const ia = fileHeadingOf(a, headingMap).index;
    const ib = fileHeadingOf(b, headingMap).index;
    if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : Number.MAX_SAFE_INTEGER) - (ib >= 0 ? ib : Number.MAX_SAFE_INTEGER);
    return fptIndex(a) - fptIndex(b);
  };
};
