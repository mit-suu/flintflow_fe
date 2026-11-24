"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { OptionAnalysis } from "@/types/pipeline";

type Analysis = Pick<OptionAnalysis, "pros" | "cons" | "risks">;

const SECTIONS = [
  { key: "pros", marker: "+", tone: "text-success" },
  { key: "cons", marker: "−", tone: "text-error" },
  { key: "risks", marker: "!", tone: "text-accent-gold-text" },
] as const;

/** Phương án có ưu / nhược / rủi ro nào để mở xem không. */
export const hasOptionAnalysis = (option: Analysis): boolean => SECTIONS.some(({ key }) => (option[key]?.length ?? 0) > 0);

/** Ba danh sách ưu / nhược / rủi ro-giả định của một phương án. Danh sách rỗng thì không vẽ. */
export function OptionAnalysisDetails({ option, id, label }: { option: Analysis; id?: string; label?: string }) {
  const t = useTranslations("common.optionAnalysis");
  return (
    <div id={id} role="group" aria-label={label} className="flex flex-col gap-1 text-caption leading-snug">
      {SECTIONS.map(({ key, marker, tone }) => {
        const items = option[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="font-bold text-on-surface">{t(key)}</span>
            <ul className="flex flex-col gap-0.5" aria-label={t(key)}>
              {items.map((item, i) => (
                <li key={i} className="flex gap-1.5 text-on-surface-muted">
                  <span aria-hidden className={`w-3 shrink-0 text-center font-bold ${tone}`}>
                    {marker}
                  </span>
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Nút "Xem ưu, nhược" + danh sách ưu / nhược / rủi ro, thu gọn mặc định (thẻ đủ phân tích dài gấp mấy lần thẻ cũ).
 * Dùng chung cho thẻ hỏi, thẻ hàng việc chờ quyết và danh sách rút yêu cầu. Không có gì để xem ⇒ không vẽ.
 */
export function OptionAnalysisToggle({ option, label, defaultOpen = false }: { option: Analysis; label: string; defaultOpen?: boolean }) {
  const t = useTranslations("common.optionAnalysis");
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!hasOptionAnalysis(option)) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="self-start flex items-center gap-1 rounded-inner px-1 -mx-1 text-caption font-semibold text-on-surface-muted hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
      >
        <Icon name={open ? "chevron-up" : "chevron-down"} size={12} />
        {open ? t("hideDetails") : t("showDetails")}
      </button>
      {open && <OptionAnalysisDetails option={option} id={id} label={t("detailsLabel", { label })} />}
    </div>
  );
}

/** Khối "Vì sao khuyến nghị" đặt dưới phương án được khuyến nghị. */
export function RecommendationReason({ reason }: { reason: string }) {
  const t = useTranslations("common.optionAnalysis");
  return (
    <div className="flex items-start gap-1.5 rounded-control bg-success-soft px-2 py-1 text-caption leading-snug">
      <Icon name="sparkle" size={12} className="mt-[2px] shrink-0 text-success" />
      <span className="min-w-0">
        <span className="font-bold text-success">{t("whyRecommended")}: </span>
        <span className="text-on-surface">{reason}</span>
      </span>
    </div>
  );
}
