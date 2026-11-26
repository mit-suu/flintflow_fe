"use client";

import { useLocale, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { FPT_SECTIONS } from "@/lib/constants/fpt-sections";
import type { Locale } from "@/lib/i18n";
import type { MappingHeadingPatch, StructurePreview as Preview } from "@/types/import";
import { importSectionTitle } from "./section-titles";

interface SectionLabelsProps {
  sections: Preview["sections"];
  busy?: boolean;
  /** Đổi nhãn một heading (mục khớp và / hoặc Ngoài phạm vi); BE tính lại bản đồ mục, không tốn credit. */
  onRelabel: (patch: MappingHeadingPatch) => void;
}

const UNMAPPED = "unmapped";

/**
 * FLF-460 (business-flow §3.1, §3.1.2) - màn đọc khung: mục khớp độ tin thấp ở bước khớp mẫu hiện dấu "chưa chắc" kèm cờ vàng
 * "Cần xem" (không dừng hỏi); mọi mục đổi được nhãn (mục khớp, vào / ra Ngoài phạm vi) trước khi bấm Bắt đầu, không tốn credit.
 */
export default function SectionLabels({ sections, busy = false, onRelabel }: SectionLabelsProps) {
  const t = useTranslations("workspace.import.relabel");
  const locale = useLocale() as Locale;
  const rows = sections.filter((s) => !!s.block_id);
  if (!rows.length) return null;
  const featured = rows.filter((s) => s.uncertain || s.scope_label);
  const others = rows.filter((s) => !s.uncertain && !s.scope_label);
  const options = FPT_SECTIONS.filter((s) => !s.group);

  const row = (s: Preview["sections"][number]) => {
    const outOfScope = s.status === "out_of_scope";
    return (
      <li key={s.block_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-surface-container-lowest px-3 py-2">
        <div className="flex-1 min-w-[200px] flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-body font-medium text-on-surface">
            <span className="truncate">{importSectionTitle(s.section_id, s.title, locale)}</span>
            {s.uncertain && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold-soft px-2 h-6 text-caption font-semibold text-accent-gold-text">
                  <Icon name="warning" size={12} />
                  {t("uncertain")}
                </span>
                <span className="inline-flex items-center rounded-full bg-accent-gold-soft px-2 h-6 text-caption font-semibold text-accent-gold-text">{t("needsReview")}</span>
              </>
            )}
            {s.scope_label && <span className="inline-flex items-center rounded-full bg-surface-container-high px-2 h-6 text-caption font-semibold text-on-surface-muted">{t(`scope.${s.scope_label}`)}</span>}
          </span>
          {s.uncertain && s.matched_title && <span className="text-caption text-on-surface-variant">{t("guess", { title: s.matched_title })}</span>}
        </div>
        <label className="inline-flex items-center gap-2 text-caption text-on-surface-variant">
          <span>{t("matchLabel")}</span>
          <select
            aria-label={t("matchAria", { title: s.title })}
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onRelabel({ block_id: s.block_id!, section_id: e.target.value });
              e.target.value = "";
            }}
            className="h-8 max-w-[220px] rounded-control bg-surface-container px-2 text-caption text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="">{t("matchKeep")}</option>
            <option value={UNMAPPED}>{t("ownSection")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{`${o.number} ${o.title}`}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRelabel({ block_id: s.block_id!, scope: outOfScope ? "in_scope" : "out_of_scope" })}
          className="text-caption font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
        >
          {outOfScope ? t("moveIn") : t("moveOut")}
        </button>
        {s.scope_label && (
          <button type="button" disabled={busy} onClick={() => onRelabel({ block_id: s.block_id!, scope: "auto" })} className="text-caption font-semibold text-on-surface-muted hover:underline cursor-pointer disabled:opacity-50">
            {t("resetScope")}
          </button>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby="section-labels-title" className="flex flex-col gap-3 rounded-card bg-surface-container p-4">
      <header className="flex flex-col gap-1">
        <h3 id="section-labels-title" className="text-body font-bold text-on-surface">
          {t("title")}
        </h3>
        <p className="text-caption text-on-surface-variant leading-relaxed">{t("hint")}</p>
      </header>
      {featured.length > 0 && <ul aria-label={t("featuredLabel")} className="flex flex-col gap-2">{featured.map(row)}</ul>}
      {others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-caption font-bold text-primary">{t("others", { count: others.length })}</summary>
          <ul className="mt-2 flex flex-col gap-2">{others.map(row)}</ul>
        </details>
      )}
    </section>
  );
}
