"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MappingReview, { useSectionOptions, type MappingReviewHeading } from "@/components/org-template/mapping-review";
import type { MappingEdit, Migration, PairEdit } from "@/types/template-migration";

interface PairTableProps {
  migration: Migration;
  busy: boolean;
  onEdit: (edits: PairEdit[]) => void;
  /** Sửa mapping heading → mục FlintFlow của file mẫu tải lên (`PATCH …/mapping`). Mẫu của tổ chức đã khoá ⇒ chỉ xem. */
  onEditMapping?: (edits: MappingEdit[]) => void;
  onConfirm: () => void;
}

const NONE = "";

/**
 * Bước 2 — ghép mục cũ ↔ mục của mẫu mới. Mỗi mục cũ (không phải phần tử) một dòng, đổi cặp lưu ngay lên BE (BE phân nhóm lại).
 * Heading phần tử (UC, chức năng, màn…) đi theo mục cha nên không hiện thành dòng riêng. Mục mới đã ghép với mục cũ khác thì
 * khoá ở các dòng còn lại (một mục mới chỉ ghép một mục cũ). Mapping của file mới hiện chỉ-xem: chỗ sửa là cột ghép này.
 */
export default function PairTable({ migration, busy, onEdit, onEditMapping, onConfirm }: PairTableProps) {
  const t = useTranslations("mode1.templateMigration.pairs");
  const listId = useId();
  const sectionOptions = useSectionOptions();
  const oldByKey = useMemo(() => new Map(migration.from.headings.map((h) => [h.key, h])), [migration.from.headings]);
  const claimed = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of migration.pairing.pairs) if (p.new_key) map.set(p.new_key, p.old_key);
    return map;
  }, [migration.pairing.pairs]);
  // Mục mới chỉ có nghĩa khi là mục nội dung (heading phần tử của mẫu đích đã bị BE bỏ qua)
  const ignored = useMemo(() => new Set(migration.pairing.ignored_new), [migration.pairing.ignored_new]);
  const targets = migration.to.headings.filter((h) => !ignored.has(h.key));
  const hasReview = migration.to.headings.some((h) => h.auto_confirmed);
  const mappingRows: MappingReviewHeading[] = migration.to.headings.map((h, i) => ({
    index: Number.isFinite(Number(h.key.replace(/^n/, ""))) ? Number(h.key.replace(/^n/, "")) : i,
    heading_text: h.heading_text,
    section_id: h.section_id,
    needs_review: h.auto_confirmed,
  }));
  // Chỉ bản riêng của dự án (file tải lên) sửa được mapping; mẫu tổ chức do Lead rà ở thư viện
  const mappingEditable = migration.direction === "forward" && migration.to.visibility === "project" && onEditMapping !== undefined;
  const reviewCount = migration.pairing.pairs.filter((p) => p.needs_review).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-on-surface-variant">{t("help")}</p>
      {migration.warnings.length > 0 && (
        <ul role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text flex flex-col gap-1">
          {migration.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {(hasReview || migration.to.visibility === "project") && (
        <details open={mappingEditable} className="rounded-card bg-surface-container-low p-3">
          <summary className="cursor-pointer text-body font-bold text-on-surface">{t("mappingSummary")}</summary>
          <div className="mt-3">
            <p className="mb-2 text-caption text-on-surface-muted">{mappingEditable ? t("mappingEditable") : t("mappingLocked")}</p>
            <MappingReview
              headings={mappingRows}
              sectionOptions={sectionOptions}
              onChange={(index, sectionId) => onEditMapping?.([{ key: `n${index}`, section_id: sectionId }])}
              disabled={busy || !mappingEditable}
            />
          </div>
        </details>
      )}
      {reviewCount > 0 && <p className="text-caption font-bold text-accent-gold-text">{t("reviewCount", { count: reviewCount })}</p>}
      <ul aria-label={t("listLabel")} className="flex flex-col gap-1.5">
        {migration.pairing.pairs.map((pair) => {
          const old = oldByKey.get(pair.old_key);
          if (!old) return null;
          const selectId = `${listId}-${pair.old_key}`;
          return (
            <li key={pair.old_key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control bg-surface-container-low px-3 py-2">
              <div className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2" style={{ paddingLeft: `${Math.max(0, old.level - 1) * 12}px` }}>
                <label htmlFor={selectId} className="text-body font-semibold text-on-surface break-words">
                  {old.heading_text}
                </label>
                {pair.needs_review && <Badge tone="warning">{t("needsReview")}</Badge>}
                {pair.by === "manual" && <Badge tone="info">{t("manual")}</Badge>}
              </div>
              <select
                id={selectId}
                value={pair.new_key ?? NONE}
                disabled={busy}
                onChange={(e) => onEdit([{ old_key: pair.old_key, new_key: e.target.value === NONE ? null : e.target.value }])}
                className="h-9 w-full sm:w-[300px] rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                <option value={NONE}>{t("noPair")}</option>
                {targets.map((h) => {
                  const owner = claimed.get(h.key);
                  return (
                    <option key={h.key} value={h.key} disabled={owner !== undefined && owner !== pair.old_key}>
                      {h.heading_text}
                    </option>
                  );
                })}
              </select>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button loading={busy} onClick={onConfirm}>
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
