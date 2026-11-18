/**
 * Đổi một thay đổi thô của Spine (`set actors[id=A03].name`) thành câu người đọc được
 * ("Sửa tên của tác nhân “Admin”: Admin → Administrator"). Dùng cho thẻ sửa trong chat và "Lịch sử sửa".
 */
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import type { Mode1T } from "./mode1/i18n";
import { spineLabels, type ElementNames } from "./mode1/spine-labels";

const MESSAGES = { vi, en } as const;
/** Tên trường / giá trị đời thường dùng chung với mode 1 (`mode1.spine.*`). */
const spineFor = (locale: Locale) =>
  spineLabels(createTranslator({ locale, messages: MESSAGES[locale], namespace: "mode1" }) as unknown as Mode1T, locale);

interface ChangeLike {
  op: string;
  path: string;
  before: unknown;
  value: unknown;
}

/** Rút gọn giá trị để hiện trên một dòng. */
export const shortValue = (value: unknown, max = 60, locale: Locale = DEFAULT_LOCALE): string => {
  if (value === null || value === undefined) return "-";
  // Không JSON: object/mảng thành "Tên: …; Mô tả: …" (FLF-247)
  const text = spineFor(locale).readableValue(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/**
 * Đầu câu theo tên phần tử (FLF-411 #23): "Xoá tác nhân “Patron”", "Đổi tên hệ thống", "Sửa tên của tác nhân “Admin”".
 * Không có tên (chỉ có mã nội bộ) ⇒ "… một tác nhân", không in mã. `names`: bảng tên từ Spine (`elementNames`).
 */
export const describeTarget = (change: ChangeLike, locale: Locale = DEFAULT_LOCALE, names?: ElementNames): string =>
  spineFor(locale).changeLabel(change, names);

const valueText = (value: unknown, field: string | undefined, locale: Locale, max = 60): string => {
  if (value === null || value === undefined) return "-";
  const text = spineFor(locale).humanValue(value, field);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/** Câu đầy đủ kèm giá trị trước → sau (chỉ phần đọc được: tên, mô tả, nhãn enum). */
export const describeChange = (change: ChangeLike, locale: Locale = DEFAULT_LOCALE, names?: ElementNames): string => {
  const target = describeTarget(change, locale, names);
  const field = /\.([a-z_]+)$/.exec(change.path)?.[1];
  const whole = !field;
  if (change.op === "remove") return target;
  // Thêm / thay nguyên phần tử: tên đã nằm trong câu
  if (whole && change.op === "add") return target;
  if (change.op === "add") return `${target}: ${valueText(change.value, field, locale)}`;
  return `${target}: ${valueText(change.before, field, locale)} → ${valueText(change.value, field, locale)}`;
};
