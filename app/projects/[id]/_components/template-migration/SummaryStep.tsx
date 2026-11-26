"use client";

import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import BrokenLinksNotice from "./BrokenLinksNotice";
import type { BrokenLink, Migration, OutlineEntry, OutlineStatus } from "@/types/template-migration";

interface SummaryStepProps {
  migration: Migration;
  applying: boolean;
  busy: boolean;
  /** Liên kết gãy báo bởi 409 `TEMPLATE_MIGRATION_LINKS_BROKEN` lúc áp dụng (ngoài `migration.broken_links` BE tính trước). */
  brokenLinks: string[];
  onApply: () => void;
  /** Quay về bước Xem lại thay đổi (chỉ khi lần đổi mẫu chưa `ready`). */
  onBack?: () => void;
  onCancel: () => void;
}

/** Màu chữ + dấu đầu dòng theo trạng thái: xanh nhận nội dung, vàng cần viết, đỏ gạch không in ra. */
const STATUS_STYLE: Record<OutlineStatus, { text: string; dot: string }> = {
  kept: { text: "text-on-surface", dot: "bg-surface-container-highest" },
  receives: { text: "text-success font-semibold", dot: "bg-success-dark" },
  needs_content: { text: "text-accent-gold-text font-semibold", dot: "bg-accent-gold" },
  dropped: { text: "text-error line-through", dot: "bg-error" },
};
const LEGEND: OutlineStatus[] = ["receives", "needs_content", "dropped"];

/**
 * Bước Áp dụng — dàn tiêu đề của tài liệu sau khi đổi (BE `outline`), theo thứ tự mẫu mới, chỉ tiêu đề; màu tự nói trạng thái, chỉ dòng
 * không in ra hiện nội dung sẽ bỏ. Kèm chi phí (chỉ khi có), cảnh báo đổi ngôn ngữ, liên kết gãy. Áp dụng là bước ghi vào bản nháp.
 */
export default function SummaryStep({ migration, applying, busy, brokenLinks, onApply, onBack, onCancel }: SummaryStepProps) {
  const t = useTranslations("mode1.templateMigration.apply");
  const tRoot = useTranslations("mode1.templateMigration");
  const { credit_estimate: credit, language } = migration;
  const outline = migration.outline ?? [];
  const counts = (s: OutlineStatus) => outline.filter((o) => o.status === s).length;
  const languageName = (code: string) => (code === "vi" || code === "en" ? t(`language.${code}`) : code);
  const links: BrokenLink[] = [...migration.broken_links, ...brokenLinks.filter((m) => !migration.broken_links.some((b) => b.message === m)).map((message) => ({ rule: "apply", path: message, message }))];
  const discarded = migration.decisions.filter((d) => d.choice === "discard").length;
  const minLevel = Math.min(...outline.map((o) => o.level), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h4 className="text-body font-extrabold text-on-surface mr-auto">{t("title")}</h4>
        {LEGEND.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-caption text-on-surface-variant">
            <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />
            {t(`legend.${s}`)} ({counts(s)})
          </span>
        ))}
      </div>

      <ol aria-label={t("title")} className="flex flex-col rounded-card bg-surface-container-low py-2">
        {outline.map((o, i) => (
          <OutlineRow key={`${i}-${o.heading_text}`} entry={o} indent={o.level - minLevel} />
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-surface-container-low px-3 py-2 text-body">
        <span className="font-bold text-on-surface">{t("credit")}</span>
        {credit.total > 0 ? (
          <span className="flex flex-wrap items-center gap-3 text-on-surface-variant">
            {language.needs_translation && <span>{t("creditTranslation", { batches: credit.translation.batches })}: {credit.translation.credits}</span>}
            {credit.ai_resolve.count + credit.structural_moves.count > 0 && <span>{t("creditAi")}: {credit.ai_resolve.credits + credit.structural_moves.credits}</span>}
            <span className="font-extrabold text-on-surface">{t("creditTotal", { count: credit.total })}</span>
          </span>
        ) : (
          <span className="text-on-surface-variant">{t("noCredit")}</span>
        )}
      </div>

      {(language.needs_translation || language.switches_document_language) && (
        <p role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text flex items-start gap-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{t(language.needs_translation ? "languageChange" : "languageChangeNoTranslation", { from: languageName(language.source), to: languageName(language.target) })}</span>
        </p>
      )}
      {migration.direction === "reverse" && discarded > 0 && <p className="text-caption text-on-surface-muted">{t("linksNote")}</p>}
      <BrokenLinksNotice links={links} />

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          {tRoot("cancelMigration")}
        </Button>
        <div className="ml-auto flex flex-wrap gap-3">
          {onBack && (
            <Button variant="secondary" disabled={busy} onClick={onBack}>
              {t("back")}
            </Button>
          )}
          <Button loading={applying} disabled={(busy && !applying) || migration.broken_links.length > 0 || migration.undecided.length > 0} onClick={onApply}>
            {applying ? t("applying") : t("apply")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OutlineRow({ entry, indent }: { entry: OutlineEntry; indent: number }) {
  const t = useTranslations("mode1.templateMigration.apply");
  const style = STATUS_STYLE[entry.status];
  const more = (entry.dropped_total ?? 0) - (entry.dropped_items?.length ?? 0);
  // Phần nhận thêm ngoài cặp chính (gộp vào / chia theo yêu cầu); BE cũ không có `parts` ⇒ theo `from_heading`
  const received = entry.parts
    ? entry.parts.filter((p) => p.kind !== "pair").map((p) => (p.kind === "distributed" ? t("partDistributed", { heading: p.heading_text }) : p.heading_text))
    : (entry.from_heading ?? []);
  return (
    <li data-status={entry.status} className="px-3 py-1" style={{ paddingLeft: `${12 + indent * 16}px` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className={`text-body break-words ${style.text}`}>{entry.heading_text}</span>
        {entry.status !== "kept" && <span className="sr-only">{t(`legend.${entry.status}`)}</span>}
        {entry.status === "receives" && received.length > 0 && <span className="text-caption text-on-surface-muted">{t("from", { from: received.join(", ") })}</span>}
        {entry.from_spine && entry.status !== "dropped" && <Badge tone="neutral">{t("fromSpine")}</Badge>}
        {entry.table_change && entry.status !== "dropped" && (
          <span title={t(`tableChange.${entry.table_change}`)}>
            <Badge tone="neutral">{t("table")}</Badge>
          </span>
        )}
      </div>
      {entry.status === "dropped" && (entry.dropped_items?.length ?? 0) > 0 && (
        <ul className="mt-1 ml-4 flex flex-col gap-0.5 text-caption text-on-surface-variant">
          {entry.dropped_items!.map((d, i) => (
            <li key={`${d.id ?? ""}-${i}`} className="break-words">
              {d.id && <span className="font-bold">{d.id}: </span>}
              {d.text}
            </li>
          ))}
          {more > 0 && <li>{t("droppedMore", { count: more })}</li>}
        </ul>
      )}
    </li>
  );
}
