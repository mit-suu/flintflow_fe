"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import MappingReview, { useSectionOptions, type MappingReviewHeading } from "@/components/org-template/mapping-review";
import { DROP_FROM_PRINT_CHOICE, type BatchAction, type ConflictItem, type EditedItem, type ExtraItem, type MappingEdit, type Migration, type MigrationDecision, type PairEdit, type PlaceTargetHint } from "@/types/template-migration";
import BrokenLinksNotice from "./BrokenLinksNotice";
import { MOVE_KEY, moveTargetKindOf, useChoiceLabel, type MoveTargetKind } from "./choice-label";
import { fold } from "./TargetPicker";

interface ReviewStepProps {
  migration: Migration;
  busy: boolean;
  onDecide: (change: { decisions?: MigrationDecision[]; batch?: BatchAction }) => void;
  onEditPairs: (edits: PairEdit[]) => void;
  /** Sửa cách đọc file mẫu tải lên (`PATCH …/mapping`); mẫu tổ chức chỉ xem. */
  onEditMapping?: (edits: MappingEdit[]) => void;
  onContinue: () => void;
  onCancel: () => void;
}

/** Giá trị trong ô chọn cho "ghép với mục …" (sửa cặp), tách khỏi lựa chọn xử lý của BE. */
const PAIR_PREFIX = "pair:";

type ReviewItem = (ExtraItem & { group: "extra" }) | (ConflictItem & { group: "conflict" });

/**
 * Bước "Xem lại thay đổi": ghép cặp và quyết định chung một màn. Mỗi dòng thừa / conflict đã có lựa chọn chọn sẵn miễn phí (BE
 * `suggested`); dòng đoán phải bấm "Đúng" hoặc chọn khác mới Tiếp tục được. Bảng đổi cột gom thành bảng gọn; mục chuyển nguyên gập lại.
 * Đổi lựa chọn không làm dòng nhảy chỗ (thứ tự theo BE).
 */
export default function ReviewStep({ migration, busy, onDecide, onEditPairs, onEditMapping, onContinue, onCancel }: ReviewStepProps) {
  const t = useTranslations("mode1.templateMigration.review");
  const tRoot = useTranslations("mode1.templateMigration");
  const { groups } = migration;
  const reverse = migration.direction === "reverse";
  const [showMapping, setShowMapping] = useState(false);
  const items: ReviewItem[] = [...groups.extra.map((e) => ({ ...e, group: "extra" as const })), ...groups.conflict.map((c) => ({ ...c, group: "conflict" as const }))];
  const isTable = (i: ReviewItem) => i.group === "conflict" && (i.kind === "table_columns" || i.kind === "record_of_changes") && i.new_key !== null && i.confidence !== "guess";
  const detailed = items.filter((i) => !isTable(i));
  const compact = items.filter(isTable);
  // Ô thống kê và tiêu đề danh sách cùng một con số: thẻ cần xem + dòng bảng đổi cột
  const chosenDetail = [detailed.length > 0 && t("chosenDetail", { count: detailed.length }), compact.length > 0 && t("chosenTables", { count: compact.length })].filter(Boolean).join(" · ");
  const toWrite = groups.missing.filter((m) => m.needs_content && !m.filled_from_spine);
  const mappingEditable = migration.direction === "forward" && migration.to.visibility === "project" && onEditMapping !== undefined;
  const pairBase = useId();
  // Mục của mẫu mới ghép được (bỏ heading phần tử ví dụ); mục đã có chủ khác bị khoá ở các dòng còn lại
  const ignoredNew = new Set(migration.pairing.ignored_new);
  const pairOptions = migration.to.headings.filter((h) => !ignoredNew.has(h.key));
  const claimedBy = new Map(migration.pairing.pairs.filter((p) => p.new_key).map((p) => [p.new_key!, p.old_key]));

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-3 gap-2">
        <Stat value={groups.matched.length} label={t("stats.matched")} />
        <Stat value={items.length} label={t("stats.chosen")} detail={chosenDetail} />
        <Stat value={toWrite.length} label={t("stats.toWrite")} tone="gold" />
      </ul>
      <p className="text-caption text-on-surface-muted">{t("free")}</p>
      {items.length > 0 && <p className="text-caption text-on-surface-muted">{t("aiNote")}</p>}

      {migration.warnings.length > 0 && (
        <ul role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text flex flex-col gap-1">
          {migration.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <BrokenLinksNotice links={migration.broken_links} />

      {reverse && groups.restored_from_snapshot !== null && (
        <p role="status" className="rounded-card bg-success-soft p-3 text-body font-semibold text-success">
          {t("restored", { count: groups.restored_from_snapshot })}
        </p>
      )}
      {reverse && groups.edited_since.length > 0 && <EditedGroup items={groups.edited_since} migration={migration} busy={busy} onChoose={(id, choice) => onDecide({ decisions: [{ id, choice }] })} onBatch={(batch) => onDecide({ batch })} />}

      {items.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("reviewTitle", { count: items.length })}</h4>
          <span className="text-caption text-on-surface-muted">{chosenDetail}</span>
        </div>
      )}

      {detailed.length > 0 && (
        <section aria-label={t("chosenDetail", { count: detailed.length })} className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {detailed.map((item) => (
              <ReviewRow key={item.id} item={item} migration={migration} busy={busy} onDecide={onDecide} onEditPairs={onEditPairs} />
            ))}
          </ul>
        </section>
      )}

      {compact.length > 0 && (
        <section aria-label={t("compactTitle", { count: compact.length })} className="flex flex-col gap-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("compactTitle", { count: compact.length })}</h4>
          <ul className="flex flex-col divide-y divide-surface-container-high rounded-card bg-surface-container-low">
            {compact.map((item) => (
              <CompactRow key={item.id} item={item as ConflictItem & { group: "conflict" }} migration={migration} busy={busy} onDecide={onDecide} />
            ))}
          </ul>
        </section>
      )}

      {toWrite.length > 0 && (
        <section aria-label={t("toWriteTitle", { count: toWrite.length })} className="flex flex-col gap-2">
          <h4 className="text-body font-extrabold text-on-surface">{t("toWriteTitle", { count: toWrite.length })}</h4>
          <ul className="flex flex-wrap gap-2">
            {toWrite.map((m) => (
              <li key={m.id} className="rounded-control bg-accent-gold-soft px-3 py-1.5 text-body font-semibold text-accent-gold-text">
                {m.heading_text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-card bg-surface-container-low p-3">
        <summary className="cursor-pointer text-body font-bold text-on-surface">{t("matchedTitle", { count: groups.matched.length })}</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {groups.matched.map((m) => {
            const followers = migration.pairing.followers.filter((f) => f.parent_old_key === m.old_key).length;
            const selectId = `${pairBase}-${m.id}`;
            return (
              <li key={m.id} className="text-body text-on-surface-variant flex flex-wrap items-center gap-2">
                <label htmlFor={selectId} className="font-semibold text-on-surface">
                  {oldText(migration, m.old_key)}
                </label>
                <span aria-hidden>→</span>
                {/* Ghép sai (nhất là cặp "Cần xem") sửa ngay ở đây: chọn mục khác của mẫu mới hoặc bỏ ghép */}
                <select
                  id={selectId}
                  value={m.new_key}
                  disabled={busy}
                  onChange={(e) => onEditPairs([{ old_key: m.old_key, new_key: e.target.value || null }])}
                  className="h-8 max-w-full rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  {pairOptions.map((h) => (
                    <option key={h.key} value={h.key} disabled={claimedBy.has(h.key) && claimedBy.get(h.key) !== m.old_key}>
                      {h.heading_text}
                    </option>
                  ))}
                  <option value="">{t("unpair")}</option>
                </select>
                {followers > 0 && <span className="text-caption text-on-surface-muted">{t("followers", { count: followers })}</span>}
                {m.needs_review && <Badge tone="warning">{t("needsReview")}</Badge>}
              </li>
            );
          })}
        </ul>
      </details>

      {(mappingEditable || migration.to.headings.some((h) => h.auto_confirmed)) && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowMapping((v) => !v)} aria-expanded={showMapping} className="self-start text-caption font-bold text-primary hover:underline">
            {t("editMapping")}
          </button>
          {showMapping && <MappingPanel migration={migration} editable={mappingEditable} busy={busy} onEditMapping={onEditMapping} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          {tRoot("cancelMigration")}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {migration.undecided.length > 0 && <p className="text-caption font-bold text-accent-gold-text">{t("undecided", { count: migration.undecided.length })}</p>}
          <Button loading={busy} disabled={migration.undecided.length > 0} onClick={onContinue}>
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const oldText = (m: Migration, key: string) => m.from.headings.find((h) => h.key === key)?.heading_text ?? key;
const newText = (m: Migration, key: string | null) => (key ? (m.to.headings.find((h) => h.key === key)?.heading_text ?? key) : "");
const decisionOf = (m: Migration, id: string): string | undefined => m.decisions.find((d) => d.id === id)?.choice;

function Stat({ value, label, tone, detail }: { value: number; label: string; tone?: "gold"; detail?: string }) {
  return (
    <li className="rounded-control bg-surface-container-low px-3 py-2 flex flex-col">
      <span className={`text-subtitle font-extrabold ${tone === "gold" && value > 0 ? "text-accent-gold-text" : "text-on-surface"}`}>{value}</span>
      <span className="text-caption text-on-surface-muted">{label}</span>
      {detail && <span className="text-caption text-on-surface-muted">{detail}</span>}
    </li>
  );
}

const MOVE_PREFIX = "move_to:";
/** Từ số mục đích này trở lên thì có ô tìm trong danh sách (mẫu lớn có ≈ 46 mục). */
const SEARCH_FROM = 10;
const MOVE_GROUPS: readonly MoveTargetKind[] = ["empty", "filled", "group"];

/**
 * Mục của mẫu mới chưa có chủ mà mục thừa ghép cặp được (sửa cặp qua PATCH pairs) — trừ mục đã là lựa chọn "chuyển vào", heading phần
 * tử ví dụ, heading con gộp vào mục cha và mục đã ghép / tách cho mục cũ khác (BE cấm hai mục cũ cùng một đích).
 */
const pairTargets = (m: Migration, item: ReviewItem): string[] => {
  if (item.group !== "extra") return [];
  const moves = new Set(item.choices.filter((c) => c.startsWith(MOVE_PREFIX)).map((c) => c.slice(MOVE_PREFIX.length)));
  const taken = new Set([...m.pairing.ignored_new, ...(m.pairing.children ?? []), ...m.pairing.split.flatMap((s) => s.new_keys)]);
  for (const p of m.pairing.pairs) if (p.new_key) taken.add(p.new_key);
  return m.to.headings.map((h) => h.key).filter((k) => !moves.has(k) && !taken.has(k));
};

/** Mục đích của lựa chọn `move_to:<k>` / `to:<k>`; lựa chọn khác ⇒ `null`. */
const targetOf = (choice: string | undefined): string | null => (choice && /^(move_to|to):/.test(choice) ? choice.slice(choice.indexOf(":") + 1) : null);

/** Câu "vì sao" ngắn theo lý do của BE (dòng bản ghi cũ không có lý do ⇒ không hiện). */
function useReason(m: Migration) {
  const t = useTranslations("mode1.templateMigration.reasons");
  return (item: ReviewItem): string | null => {
    const reason = item.suggested_reason;
    if (!reason) return null;
    const target = newText(m, targetOf(item.suggested));
    if (reason === "close_name" || reason === "same_data") return t(reason, { target });
    if (reason === "best_fit") return item.suggested === "distribute" || !target ? t("best_fit_distribute") : t("best_fit", { target });
    if (reason === "first_heading") return t("first_heading", { count: item.group === "conflict" ? item.candidate_keys.length : 2 });
    return t(reason);
  };
}

/** Hậu quả của lựa chọn đang hiệu lực, một câu. `pairKey`: mục của mẫu mới đang ghép với dòng (cho "Giữ cặp hiện tại"). */
function useConsequence(m: Migration) {
  const t = useTranslations("mode1.templateMigration.consequence");
  const kindOf = moveTargetKindOf(m);
  return (choice: string | undefined, pairKey: string | null): string | null => {
    if (!choice) return null;
    if (choice.startsWith(PAIR_PREFIX)) return t("pair", { target: newText(m, choice.slice(PAIR_PREFIX.length)) });
    if (choice === "keep_pair") return t("keep_pair", { target: newText(m, pairKey) });
    const sep = choice.indexOf(":");
    if (sep > 0) {
      const kind = choice.slice(0, sep);
      const key = choice.slice(sep + 1);
      if (kind === "move_to") return t(MOVE_KEY[kindOf(key)], { target: newText(m, key) });
      return kind === "to" ? t(kind, { target: newText(m, key) }) : null;
    }
    return ["drop_from_print", "keep_custom", "delete", "map_by_header", "keep_old_table", "ai_resolve", "distribute"].includes(choice) ? t(choice as "delete") : null;
  };
}

interface RowProps {
  migration: Migration;
  busy: boolean;
  onDecide: ReviewStepProps["onDecide"];
}

function ReviewRow({ item, migration, busy, onDecide, onEditPairs }: RowProps & { item: ReviewItem; onEditPairs: ReviewStepProps["onEditPairs"] }) {
  const t = useTranslations("mode1.templateMigration.review");
  const label = useChoiceLabel(migration);
  const reason = useReason(migration)(item);
  const consequenceOf = useConsequence(migration);
  const id = useId();
  const decided = decisionOf(migration, item.id);
  const value = decided ?? item.suggested;
  const guessOpen = item.confidence === "guess" && decided === undefined;
  const title = item.group === "extra" ? item.heading_text : oldText(migration, item.old_key);
  const kindOf = moveTargetKindOf(migration);
  const [query, setQuery] = useState("");
  // Nhóm Thừa không còn "Xoá" (BE đã bỏ; lọc phòng BE cũ): xoá hẳn nội dung thì tạo CR sau khi áp mẫu
  const visible = item.choices.filter((c) => !(item.group === "extra" && c === "delete"));
  // Gợi ý: các mục BE chấm điểm cao nhất (bản ghi cũ không có ⇒ không có nhóm này), chỉ lấy mục là lựa chọn hợp lệ của dòng
  const hints = (item.targets ?? []).flatMap((hint): { hint: PlaceTargetHint; choice: string }[] => {
    const choice = [`${MOVE_PREFIX}${hint.new_key}`, `to:${hint.new_key}`].find((c) => visible.includes(c));
    return choice ? [{ hint, choice }] : [];
  });
  const hinted = new Set(hints.map((h) => h.choice));
  const plain = visible.filter((c) => !c.startsWith(MOVE_PREFIX) && !hinted.has(c));
  const moves = visible.filter((c) => c.startsWith(MOVE_PREFIX) && !hinted.has(c));
  const pairs = pairTargets(migration, item);
  const searchable = moves.length + pairs.length >= SEARCH_FROM;
  const q = fold(query.trim());
  // Lựa chọn đang hiệu lực luôn còn trong danh sách để ô chọn không hiện sai khi đang lọc
  const shown = (choice: string, key: string) => !q || choice === value || fold(newText(migration, key)).includes(q);
  const moveGroups = MOVE_GROUPS.map((kind) => ({ kind, list: moves.filter((c) => kindOf(c.slice(MOVE_PREFIX.length)) === kind && shown(c, c.slice(MOVE_PREFIX.length))) })).filter((g) => g.list.length > 0);
  const shownPairs = pairs.filter((k) => shown(`${PAIR_PREFIX}${k}`, k));
  const droppedData = value === DROP_FROM_PRINT_CHOICE && (item.data_size ?? 0) > 0 ? item.data_size! : 0;
  const consequence = consequenceOf(value, item.group === "conflict" ? item.new_key : null);

  const option = (c: string, why?: string) => (
    <option key={c} value={c}>
      {label(c)}
      {why ? ` · ${why}` : ""}
      {item.ai_choices.includes(c) || c === "ai_resolve" ? ` ${t("aiSuffix")}` : ""}
    </option>
  );

  const onChange = (v: string) => {
    if (v.startsWith(PAIR_PREFIX)) onEditPairs([{ old_key: item.old_key, new_key: v.slice(PAIR_PREFIX.length) }]);
    else onDecide({ decisions: [{ id: item.id, choice: v }] });
  };

  return (
    <li className={`rounded-control px-3 py-2.5 flex flex-col gap-1.5 ${guessOpen ? "bg-accent-gold-soft" : "bg-surface-container-low"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex-1 min-w-[200px] flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <label htmlFor={id} className="text-body font-semibold text-on-surface break-words">
              {title}
            </label>
            {item.confidence && <Badge tone={item.confidence === "guess" ? "warning" : "neutral"}>{t(item.confidence === "guess" ? "guess" : "suggested")}</Badge>}
            {item.group === "conflict" && item.kind === "split_section" && <Badge tone="info">{t("split")}</Badge>}
            {item.group === "conflict" && item.kind === "placement" && <Badge tone="info">{t("placement")}</Badge>}
          </span>
          {reason && <span className="text-caption text-on-surface-muted break-words">{reason}</span>}
        </div>
        <select
          id={id}
          value={value ?? ""}
          disabled={busy}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-9 w-full sm:w-[300px] rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          {value === undefined && <option value="">{t("pick")}</option>}
          {plain.map((c) => option(c))}
          {hints.length > 0 && <optgroup label={t("targetGroups.suggested")}>{hints.map(({ hint, choice }) => option(choice, hint.why.map((w) => t(`why.${w}`)).join(", ")))}</optgroup>}
          {moveGroups.map((g) => (
            <optgroup key={g.kind} label={t(`targetGroups.${g.kind}`)}>
              {g.list.map((c) => option(c))}
            </optgroup>
          ))}
          {shownPairs.map((k) => (
            <option key={k} value={`${PAIR_PREFIX}${k}`}>
              {t("pairWith", { target: newText(migration, k) })}
            </option>
          ))}
        </select>
        {guessOpen && item.suggested && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecide({ decisions: [{ id: item.id, choice: item.suggested! }] })}>
            {t("correct")}
          </Button>
        )}
      </div>
      {searchable && (
        <SearchInput value={query} onChange={setQuery} label={t("searchTargets")} placeholder={t("searchPlaceholder", { count: moves.length + hints.length + pairs.length })} className="w-full sm:w-[300px] sm:self-end" />
      )}
      {consequence && <p className="text-caption text-on-surface-variant break-words">{consequence}</p>}
      {droppedData > 0 && <p className="text-caption font-semibold text-accent-gold-text">{t("dropData", { count: droppedData })}</p>}
    </li>
  );
}

function CompactRow({ item, migration, busy, onDecide }: RowProps & { item: ConflictItem & { group: "conflict" } }) {
  const t = useTranslations("mode1.templateMigration.review");
  const label = useChoiceLabel(migration);
  const reason = useReason(migration)(item);
  const id = useId();
  const value = decisionOf(migration, item.id) ?? item.suggested;
  return (
    <li className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex-1 min-w-[200px] flex flex-col">
        <label htmlFor={id} className="text-body font-semibold text-on-surface break-words">
          {oldText(migration, item.old_key)}
        </label>
        <span className="text-caption text-on-surface-muted break-words">
          {reason}
          {item.old_columns.length > 0 && <> · {t("columnsOld", { columns: item.old_columns.map((c) => c.join(" | ")).join(" ; ") })}</>}
          {item.new_columns.length > 0 && <> · {t("columnsNew", { columns: item.new_columns.map((c) => c.join(" | ")).join(" ; ") })}</>}
        </span>
      </div>
      <select
        id={id}
        value={value ?? ""}
        disabled={busy}
        onChange={(e) => e.target.value && onDecide({ decisions: [{ id: item.id, choice: e.target.value }] })}
        className="h-9 w-full sm:w-[260px] rounded-control bg-surface-container-lowest px-2 text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {value === undefined && <option value="">{t("pick")}</option>}
        {item.choices.map((c) => (
          <option key={c} value={c}>
            {label(c)}
            {item.ai_choices.includes(c) ? ` ${t("aiSuffix")}` : ""}
          </option>
        ))}
      </select>
    </li>
  );
}

function MappingPanel({ migration, editable, busy, onEditMapping }: { migration: Migration; editable: boolean; busy: boolean; onEditMapping?: (edits: MappingEdit[]) => void }) {
  const t = useTranslations("mode1.templateMigration.review");
  const sectionOptions = useSectionOptions();
  const rows: MappingReviewHeading[] = migration.to.headings.map((h, i) => ({
    index: Number.isFinite(Number(h.key.replace(/^n/, ""))) ? Number(h.key.replace(/^n/, "")) : i,
    heading_text: h.heading_text,
    section_id: h.section_id,
    needs_review: h.auto_confirmed,
  }));
  return (
    <div className="rounded-card bg-surface-container-low p-3 flex flex-col gap-2">
      {!editable && <p className="text-caption text-on-surface-muted">{t("mappingLocked")}</p>}
      <MappingReview headings={rows} sectionOptions={sectionOptions} onChange={(index, sectionId) => onEditMapping?.([{ key: `n${index}`, section_id: sectionId }])} disabled={busy || !editable} />
    </div>
  );
}

function EditedGroup({ items, migration, busy, onChoose, onBatch }: { items: EditedItem[]; migration: Migration; busy: boolean; onChoose: (id: string, choice: string) => void; onBatch: (batch: BatchAction) => void }) {
  const t = useTranslations("mode1.templateMigration.review");
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
                  <label key={choice} className={`px-3 py-1 rounded-full text-body font-bold cursor-pointer ${value === choice ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant"}`}>
                    <input type="radio" name={name} value={choice} checked={value === choice} disabled={busy} onChange={() => onChoose(item.id, choice)} className="sr-only" />
                    {t(choice)}
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
