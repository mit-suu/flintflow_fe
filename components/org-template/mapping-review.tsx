"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import { CONTENT_SLOTS } from "@/lib/constants/content-slots";
import { FPT_SECTIONS, sectionLabel } from "@/lib/constants/fpt-sections";
import { isLocale } from "@/lib/i18n";

export interface MappingReviewHeading {
  /** Vị trí heading trong file — khoá dùng để báo đổi section. */
  index: number;
  heading_text: string;
  section_id: string;
  /** Mapping tự nhận vì độ tin thấp ⇒ nổi lên mục "Cần xem". */
  needs_review?: boolean;
  /** Đã sửa trong phiên này: giữ `needs_review` gốc để dòng không nhảy / mất khi lọc, chỉ ẩn nhãn. */
  reviewed?: boolean;
}

export interface SectionOption {
  id: string;
  label: string;
}

interface MappingReviewProps {
  headings: readonly MappingReviewHeading[];
  sectionOptions: readonly SectionOption[];
  onChange: (index: number, sectionId: string) => void;
  disabled?: boolean;
}

/**
 * Danh mục section chọn được khi rà mapping: "không khớp" (giữ làm mục riêng), mục của mẫu FlintFlow, các phần nhỏ của mẫu khách.
 * Nhãn theo ngôn ngữ giao diện.
 */
export function useSectionOptions(): SectionOption[] {
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";
  return useMemo(
    () =>
      ["unmapped", ...FPT_SECTIONS.map((s) => s.id), ...CONTENT_SLOTS.map((s) => s.id)].map((id) => ({ id, label: sectionLabel(id, locale) })),
    [locale]
  );
}

/**
 * Rà mapping heading → section của một file mẫu: mỗi dòng một heading với ô chọn section; mục "Cần xem" (độ tin thấp) lên đầu danh
 * sách và có thể lọc riêng. Thuần hiển thị — không gọi API, người dùng truyền danh sách heading, danh mục section và xử lý đổi.
 */
export default function MappingReview({ headings, sectionOptions, onChange, disabled = false }: MappingReviewProps) {
  const t = useTranslations("app.org.templateMapping");
  const listId = useId();
  const [onlyReview, setOnlyReview] = useState(false);
  const reviewCount = headings.filter((h) => h.needs_review).length;
  const shown = useMemo(() => {
    const rows = onlyReview ? headings.filter((h) => h.needs_review) : [...headings];
    // Sắp ổn định: "Cần xem" lên trước, giữ thứ tự trong file giữa các dòng cùng nhóm
    return rows.sort((a, b) => Number(!!b.needs_review) - Number(!!a.needs_review));
  }, [headings, onlyReview]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[220px] text-body text-on-surface-variant">{t("help")}</p>
        {reviewCount > 0 && (
          <label className="inline-flex items-center gap-2 text-caption font-bold text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
            {t("onlyReview", { count: reviewCount })}
          </label>
        )}
      </div>
      {headings.length === 0 ? (
        <p className="text-body text-on-surface-muted">{t("empty")}</p>
      ) : (
        <ul aria-label={t("listLabel")} className="flex flex-col gap-1.5">
          {shown.map((h) => {
            const selectId = `${listId}-${h.index}`;
            const known = sectionOptions.some((o) => o.id === h.section_id);
            return (
              <li key={h.index} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control bg-surface-container-low px-3 py-2">
                <div className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2">
                  <label htmlFor={selectId} className="text-body font-semibold text-on-surface break-words">
                    {h.heading_text}
                  </label>
                  {h.needs_review && !h.reviewed && <Badge tone="warning">{t("needsReview")}</Badge>}
                </div>
                <select
                  id={selectId}
                  value={h.section_id}
                  disabled={disabled}
                  onChange={(e) => onChange(h.index, e.target.value)}
                  className="h-9 w-full sm:w-[280px] rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  {!known && <option value={h.section_id}>{sectionLabel(h.section_id)}</option>}
                  {sectionOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
