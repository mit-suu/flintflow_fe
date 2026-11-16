"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import BrokenLinksNotice from "./BrokenLinksNotice";
import type { BrokenLink, Migration } from "@/types/template-migration";

interface SummaryStepProps {
  migration: Migration;
  applying: boolean;
  busy: boolean;
  /** Liên kết gãy báo bởi 409 `TEMPLATE_MIGRATION_LINKS_BROKEN` lúc áp dụng (ngoài `migration.broken_links` BE tính trước). */
  brokenLinks: string[];
  onApply: () => void;
  onCancel: () => void;
}

/**
 * Bước 4 — tóm tắt trước khi áp dụng: số mục mỗi nhóm, credit ước tính (dịch, chuyển mục cấu trúc, AI — chốt khi áp dụng),
 * cảnh báo đổi ngôn ngữ. Áp dụng là bước ghi vào bản nháp; Huỷ bỏ lần đổi mẫu mà không đụng tài liệu.
 */
export default function SummaryStep({ migration, applying, busy, brokenLinks, onApply, onCancel }: SummaryStepProps) {
  const t = useTranslations("mode1.templateMigration.summary");
  const { groups, credit_estimate: credit, language } = migration;
  const reverse = migration.direction === "reverse";
  type RowKey = "matched" | "missing" | "extra" | "conflict" | "restored" | "edited";
  const rows: { key: RowKey; count: number }[] = [
    { key: "matched", count: groups.matched.length },
    { key: "missing", count: groups.missing.length },
    { key: "extra", count: groups.extra.length },
    { key: "conflict", count: groups.conflict.length },
    ...(reverse ? ([{ key: "restored", count: groups.restored_from_snapshot ?? 0 }, { key: "edited", count: groups.edited_since.length }] as const) : []),
  ];
  const languageName = (code: string) => (code === "vi" || code === "en" ? t(`language.${code}`) : code);
  const links: BrokenLink[] = [...migration.broken_links, ...brokenLinks.filter((m) => !migration.broken_links.some((b) => b.message === m)).map((message) => ({ rule: "apply", path: message, message }))];
  const discarded = migration.decisions.filter((d) => d.choice === "discard").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-on-surface-variant">{t("intro", { name: migration.to.name, version: migration.to.version })}</p>

      <ul aria-label={t("countsLabel")} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-control bg-surface-container-low px-3 py-2 flex flex-col">
            <span className="text-subtitle font-extrabold text-on-surface">{r.count}</span>
            <span className="text-caption text-on-surface-muted">{t(`rows.${r.key}`)}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-card bg-surface-container-low p-3 flex flex-col gap-1.5">
        <h4 className="text-body font-extrabold text-on-surface">{t("creditTitle")}</h4>
        <dl className="text-body text-on-surface-variant flex flex-col gap-1">
          {language.needs_translation && (
            <div className="flex justify-between gap-3">
              <dt>{t("creditTranslation", { batches: credit.translation.batches })}</dt>
              <dd className="font-bold text-on-surface">{credit.translation.credits}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt>{t("creditMoves", { count: credit.structural_moves.count })}</dt>
            <dd className="font-bold text-on-surface">{credit.structural_moves.credits}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("creditAi", { count: credit.ai_resolve.count })}</dt>
            <dd className="font-bold text-on-surface">{credit.ai_resolve.credits}</dd>
          </div>
          <div className="flex justify-between gap-3 pt-1.5 text-on-surface">
            <dt className="font-extrabold">{t("creditTotal")}</dt>
            <dd className="font-extrabold">{credit.total}</dd>
          </div>
        </dl>
        <p className="text-caption text-on-surface-muted">{t("creditNote")}</p>
      </div>

      {(language.needs_translation || language.switches_document_language) && (
        <p role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text flex items-start gap-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{t(language.needs_translation ? "languageChange" : "languageChangeNoTranslation", { from: languageName(language.source), to: languageName(language.target) })}</span>
        </p>
      )}

      {reverse && discarded > 0 && <p className="text-caption text-on-surface-muted">{t("linksNote")}</p>}

      <BrokenLinksNotice links={links} />

      {migration.warnings.length > 0 && (
        <ul className="text-caption text-accent-gold-text flex flex-col gap-0.5">
          {migration.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button loading={applying} disabled={(busy && !applying) || migration.broken_links.length > 0} onClick={onApply}>
          {applying ? t("applying") : t("apply")}
        </Button>
      </div>
    </div>
  );
}
