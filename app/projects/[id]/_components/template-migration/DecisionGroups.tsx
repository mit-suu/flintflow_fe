"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { DROP_FROM_PRINT_CHOICE, type BatchAction, ConflictItem, EditedItem, ExtraItem, Migration, MigrationDecision } from "@/types/template-migration";
import BrokenLinksNotice from "./BrokenLinksNotice";
import { useChoiceLabel } from "./choice-label";

interface DecisionGroupsProps {
  migration: Migration;
  busy: boolean;
  onDecide: (change: { decisions?: MigrationDecision[]; batch?: BatchAction }) => void;
  onContinue: () => void;
}

const decisionOf = (migration: Migration, id: string): string | undefined => migration.decisions.find((d) => d.id === id)?.choice;

/**
 * Bước 3 — các nhóm của lần đổi mẫu: khớp (chỉ xem), thiếu (thêm trống + hướng dẫn), thừa (giữ / chuyển / xoá), conflict (chọn
 * hoặc để AI), và với đổi ngược: số mục tự trở về nguyên bản + nhóm "đã sửa sau lần đổi mẫu" (Giữ / Bỏ, mặc định Giữ).
 * Mục thừa + conflict bắt buộc có lựa chọn mới đi tiếp (BE trả `undecided`).
 */
export default function DecisionGroups({ migration, busy, onDecide, onContinue }: DecisionGroupsProps) {
  const t = useTranslations("mode1.templateMigration.groups");
  const label = useChoiceLabel(migration);
  const { groups } = migration;
  const reverse = migration.direction === "reverse";
  const undecided = new Set(migration.undecided);
  const oldText = (key: string) => migration.from.headings.find((h) => h.key === key)?.heading_text ?? key;
  const newText = (key: string | null) => (key ? (migration.to.headings.find((h) => h.key === key)?.heading_text ?? key) : "");

  const choose = (id: string, choice: string) => onDecide({ decisions: [{ id, choice }] });

  return (
    <div className="flex flex-col gap-5">
      {reverse && groups.restored_from_snapshot !== null && (
        <p role="status" className="rounded-card bg-success-soft p-3 text-body font-semibold text-success">
          {t("restored", { count: groups.restored_from_snapshot })}
        </p>
      )}

      <BrokenLinksNotice links={migration.broken_links} />

      {reverse && groups.edited_since.length > 0 && (
        <EditedGroup items={groups.edited_since} migration={migration} busy={busy} onChoose={choose} onBatch={(batch) => onDecide({ batch })} />
      )}

      {groups.conflict.length > 0 && (
        <section aria-label={t("conflictTitle", { count: groups.conflict.length })} className="flex flex-col gap-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("conflictTitle", { count: groups.conflict.length })}</h4>
          <p className="text-caption text-on-surface-muted">{t("conflictHelp")}</p>
          <ul className="flex flex-col gap-2">
            {groups.conflict.map((c) => (
              <ConflictRow key={c.id} item={c} title={oldText(c.old_key)} target={newText(c.new_key)} value={decisionOf(migration, c.id)} undecided={undecided.has(c.id)} busy={busy} label={label} onChoose={choose} />
            ))}
          </ul>
        </section>
      )}

      {groups.extra.length > 0 && (
        <section aria-label={t("extraTitle", { count: groups.extra.length })} className="flex flex-col gap-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("extraTitle", { count: groups.extra.length })}</h4>
          <p className="text-caption text-on-surface-muted">{t("extraHelp")}</p>
          <ul className="flex flex-col gap-2">
            {groups.extra.map((e) => (
              <ExtraRow key={e.id} item={e} value={decisionOf(migration, e.id)} undecided={undecided.has(e.id)} busy={busy} label={label} onChoose={choose} />
            ))}
          </ul>
        </section>
      )}

      {groups.missing.length > 0 && (
        <section aria-label={t("missingTitle", { count: groups.missing.length })} className="flex flex-col gap-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("missingTitle", { count: groups.missing.length })}</h4>
          <p className="text-caption text-on-surface-muted">{t("missingHelp")}</p>
          <ul className="flex flex-col gap-1.5">
            {groups.missing.map((m) => (
              <li key={m.id} className="rounded-control bg-surface-container-low px-3 py-2 flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-body font-semibold text-on-surface">
                  {m.heading_text}
                  {m.needs_content && <Badge tone="danger">{t("needsContent")}</Badge>}
                </span>
                {m.guidance && <span className="text-caption text-on-surface-muted break-words">{m.guidance}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-card bg-surface-container-low p-3">
        <summary className="cursor-pointer text-body font-bold text-on-surface">{t("matchedTitle", { count: groups.matched.length })}</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {groups.matched.map((m) => (
            <li key={m.id} className="text-body text-on-surface-variant flex flex-wrap items-center gap-2">
              <span className="font-semibold text-on-surface">{oldText(m.old_key)}</span>
              <span aria-hidden>→</span>
              <span>{newText(m.new_key)}</span>
              {m.needs_review && <Badge tone="warning">{t("needsReview")}</Badge>}
            </li>
          ))}
        </ul>
        {groups.structure_only_dropped.length > 0 && <p className="mt-2 text-caption text-on-surface-muted">{t("droppedNote", { count: groups.structure_only_dropped.length })}</p>}
      </details>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {migration.undecided.length > 0 && <p className="text-caption font-bold text-accent-gold-text">{t("undecided", { count: migration.undecided.length })}</p>}
        <Button loading={busy} disabled={migration.undecided.length > 0} onClick={onContinue}>
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}

interface ChoiceSelectProps {
  id: string;
  value: string | undefined;
  choices: string[];
  aiChoices: string[];
  busy: boolean;
  label: (choice: string) => string;
  placeholder: string;
  aiSuffix: string;
  onChange: (choice: string) => void;
}

function ChoiceSelect({ id, value, choices, aiChoices, busy, label, placeholder, aiSuffix, onChange }: ChoiceSelectProps) {
  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={busy}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-9 w-full sm:w-[320px] rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
    >
      {value === undefined && <option value="">{placeholder}</option>}
      {choices.map((c) => (
        <option key={c} value={c}>
          {label(c)}
          {aiChoices.includes(c) ? ` ${aiSuffix}` : ""}
        </option>
      ))}
    </select>
  );
}

interface RowCommon {
  busy: boolean;
  undecided: boolean;
  value: string | undefined;
  label: (choice: string) => string;
  onChoose: (id: string, choice: string) => void;
}

function ExtraRow({ item, value, undecided, busy, label, onChoose }: RowCommon & { item: ExtraItem }) {
  const t = useTranslations("mode1.templateMigration.groups");
  const id = useId();
  return (
    <li className="rounded-control bg-surface-container-low px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="flex-1 min-w-[200px] text-body font-semibold text-on-surface break-words">
        {item.heading_text}
        {item.follower_keys.length > 0 && <span className="ml-2 text-caption font-normal text-on-surface-muted">{t("followers", { count: item.follower_keys.length })}</span>}
      </label>
      {undecided && <Badge tone="warning">{t("choose")}</Badge>}
      {item.choices.includes(DROP_FROM_PRINT_CHOICE) && <p className="basis-full text-caption text-on-surface-muted">{t("dropFromPrintHelp")}</p>}
      <ChoiceSelect id={id} value={value} choices={item.choices} aiChoices={item.ai_choices} busy={busy} label={label} placeholder={t("pick")} aiSuffix={t("aiSuffix")} onChange={(c) => onChoose(item.id, c)} />
    </li>
  );
}

function ConflictRow({ item, title, target, value, undecided, busy, label, onChoose }: RowCommon & { item: ConflictItem; title: string; target: string }) {
  const t = useTranslations("mode1.templateMigration.groups");
  const id = useId();
  return (
    <li className="rounded-control bg-surface-container-low px-3 py-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={id} className="flex-1 min-w-[200px] text-body font-semibold text-on-surface break-words">
          {title}
          {target && <span className="ml-2 text-caption font-normal text-on-surface-muted">→ {target}</span>}
        </label>
        <Badge tone="info">{t(`conflictKind.${item.kind}`)}</Badge>
        {undecided && <Badge tone="warning">{t("choose")}</Badge>}
        {item.choices.includes(DROP_FROM_PRINT_CHOICE) && <p className="basis-full text-caption text-on-surface-muted">{t("dropFromPrintHelp")}</p>}
        <ChoiceSelect id={id} value={value} choices={item.choices} aiChoices={item.ai_choices} busy={busy} label={label} placeholder={t("pick")} aiSuffix={t("aiSuffix")} onChange={(c) => onChoose(item.id, c)} />
      </div>
      {item.kind === "table_columns" && (
        <p className="text-caption text-on-surface-muted break-words">
          {t("columnsOld", { columns: item.old_columns.map((c) => c.join(" | ")).join(" ; ") })}
          {item.new_columns.length > 0 && <> · {t("columnsNew", { columns: item.new_columns.map((c) => c.join(" | ")).join(" ; ") })}</>}
        </p>
      )}
    </li>
  );
}

function EditedGroup({
  items,
  migration,
  busy,
  onChoose,
  onBatch,
}: {
  items: EditedItem[];
  migration: Migration;
  busy: boolean;
  onChoose: (id: string, choice: string) => void;
  onBatch: (batch: BatchAction) => void;
}) {
  const t = useTranslations("mode1.templateMigration.groups");
  const group = useId();
  return (
    <section aria-label={t("editedTitle", { count: items.length })} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="flex-1 min-w-[200px] text-body font-extrabold text-on-surface">{t("editedTitle", { count: items.length })}</h4>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onBatch("keep_all")}>
          {t("keepAll")}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onBatch("discard_all")}>
          {t("discardAll")}
        </Button>
      </div>
      <p className="text-caption text-on-surface-muted">{t("editedHelp")}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const value = decisionOf(migration, item.id) ?? item.default;
          const name = `${group}-${item.id}`;
          return (
            <li key={item.id} className="rounded-control bg-surface-container-low px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex-1 min-w-[200px] flex flex-col">
                <span className="text-body font-semibold text-on-surface break-words">{item.heading_text}</span>
                <span className="text-caption text-on-surface-muted">{t("editedMeta", { count: item.changes })}</span>
              </div>
              <div role="radiogroup" aria-label={item.heading_text} className="flex gap-1 p-1 rounded-full bg-surface-container-high">
                {(["keep", "discard"] as const).map((choice) => (
                  <label
                    key={choice}
                    className={`px-3 py-1 rounded-full text-body font-bold cursor-pointer ${value === choice ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant"}`}
                  >
                    <input type="radio" name={name} value={choice} checked={value === choice} disabled={busy} onChange={() => onChoose(item.id, choice)} className="sr-only" />
                    {t(choice === "keep" ? "keep" : "discard")}
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
