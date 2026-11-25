"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { BlockDiffEntry, BlockDiffSummary, DiffSectionStat, TableDiff, TableRowDiff } from "@/types/import";
import { diffWords } from "./word-diff";

export type DiffMode = "unified" | "split";

interface VersionDiffViewProps {
  entries: BlockDiffEntry[];
  /** Số block không đổi theo mục (BE); bản ghi cũ không có. */
  sections?: DiffSectionStat[];
  /** Chữ đầu hàng điều khiển, vd `0.4 → 1.0`. */
  heading?: ReactNode;
  /** Nhãn hai cột ở chế độ Hai cột. */
  fromLabel: string;
  toLabel: string;
}

/** Tóm tắt số đoạn thêm / xoá / sửa / di chuyển — chữ theo ngôn ngữ giao diện. */
export function DiffSummary({ summary }: { summary: BlockDiffSummary }) {
  const t = useTranslations("mode1.blockDiff");
  return <>{t("summary", { added: summary.added, removed: summary.removed, modified: summary.modified, moved: summary.moved })}</>;
}

interface SectionGroup {
  key: string;
  title: string | null;
  entries: BlockDiffEntry[];
  unchanged: number;
}

/**
 * Gom entry theo khoá mục (đường heading; bản ghi cũ dùng tên mục), giữ thứ tự xuất hiện; entry không có mục hoặc trước heading đầu vào
 * nhóm "Khác" (`title = null`). Hai mục trùng tên ở hai chỗ ("Luồng chính" dưới hai UC) là hai nhóm.
 */
const OTHER = "\u0000other";
const groupBySection = (entries: readonly BlockDiffEntry[], stats: readonly DiffSectionStat[]): SectionGroup[] => {
  const groups = new Map<string, SectionGroup>();
  for (const e of entries) {
    const title = e.section ? e.section : null;
    const key = title ? (e.section_key ?? title) : OTHER;
    if (!groups.has(key)) groups.set(key, { key, title, entries: [], unchanged: 0 });
    groups.get(key)!.entries.push(e);
  }
  for (const s of stats) {
    const g = groups.get(s.title ? (s.key ?? s.title) : OTHER);
    if (g) g.unchanged += s.unchanged;
  }
  return [...groups.values()];
};

/** Đếm +thêm −xoá ~sửa của một mục (bảng tính theo hàng). */
const countsOf = (entries: readonly BlockDiffEntry[]) => {
  let add = 0;
  let del = 0;
  let mod = 0;
  for (const e of entries) {
    if (e.table) {
      for (const r of e.table.rows) {
        if (r.change === "added") add++;
        else if (r.change === "removed") del++;
        else if (r.change === "modified") mod++;
      }
    } else if (e.change === "added") add++;
    else if (e.change === "removed") del++;
    else if (e.change === "modified") mod++;
  }
  return { add, del, mod };
};

/**
 * Khác biệt giữa hai bản kiểu code review (so sánh version UC-50, tải lại file UC-25): cột trái danh sách mục có thay đổi (bấm nhảy
 * tới), mỗi mục một khối; bảng chỉ hiện hàng đổi (phần không đổi gập `⋯ n hàng`), đoạn sửa chỉ tô chữ đổi; Một cột / Hai cột.
 * Màn hẹp: danh sách mục lên trên, hai cột tự về một cột. Phẳng, không viền: phân tách bằng nền.
 */
export default function VersionDiffView({ entries, sections = [], heading, fromLabel, toLabel }: VersionDiffViewProps) {
  const t = useTranslations("mode1.versionCompare");
  const [mode, setMode] = useState<DiffMode>("unified");
  const base = useId();
  const groups = groupBySection(entries, sections);
  const anchor = (key: string) => `${base}-${groups.findIndex((g) => g.key === key)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {heading && <div className="mr-auto text-body font-bold text-on-surface tabular-nums">{heading}</div>}
        <div role="radiogroup" aria-label={t("viewMode")} className={`flex gap-1 p-1 rounded-full bg-surface-container-high ${heading ? "" : "ml-auto"}`}>
          {(["unified", "split"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full text-caption font-bold ${mode === m ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant"}`}
            >
              {t(m === "unified" ? "oneColumn" : "twoColumns")}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-body text-on-surface-muted">{t("noChanges")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label={t("changedSections")} className="md:sticky md:top-0 self-start">
            <ul className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-2">
              {groups.map((g) => {
                const c = countsOf(g.entries);
                return (
                  <li key={g.key}>
                    <a href={`#${anchor(g.key)}`} className="flex items-center gap-2 rounded-control px-2 py-1 text-caption text-on-surface hover:bg-surface-container">
                      <span className="flex-1 min-w-0 truncate font-semibold">{g.title ?? t("other")}</span>
                      <span className="shrink-0 tabular-nums font-bold">
                        {c.add > 0 && <span className="text-success">+{c.add} </span>}
                        {c.del > 0 && <span className="text-error">−{c.del} </span>}
                        {c.mod > 0 && <span className="text-accent-gold-text">~{c.mod}</span>}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-4 min-w-0">
            {mode === "split" && (
              <div className="hidden md:grid grid-cols-2 gap-2 px-1 text-caption font-bold text-on-surface-muted tabular-nums">
                <span>{fromLabel}</span>
                <span>{toLabel}</span>
              </div>
            )}
            {groups.map((g) => (
              <section key={g.key} id={anchor(g.key)} aria-label={g.title ?? t("other")} className="flex flex-col gap-2 scroll-mt-4">
                <h4 className="text-body font-extrabold text-on-surface break-words">{g.title ?? t("other")}</h4>
                {g.entries.map((e, i) => (
                  <EntryView key={`${e.block_id ?? "b"}-${i}`} entry={e} mode={mode} />
                ))}
                {g.unchanged > 0 && <p className="text-caption text-on-surface-muted">{t("unchangedParagraphs", { count: g.unchanged })}</p>}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Words({ before, after, side }: { before: string; after: string; side: "both" | "old" | "new" }) {
  return (
    <>
      {diffWords(before, after).map((p, i) => {
        if (p.op === "same") return <span key={i}>{p.text}</span>;
        if (p.op === "del") return side === "new" ? null : <del key={i} className="bg-error-container text-error rounded-sm">{p.text}</del>;
        return side === "old" ? null : <ins key={i} className="bg-success-soft text-success no-underline rounded-sm">{p.text}</ins>;
      })}
    </>
  );
}

function EntryView({ entry, mode }: { entry: BlockDiffEntry; mode: DiffMode }) {
  const t = useTranslations("mode1.versionCompare");
  if (entry.table) return <TableView table={entry.table} mode={mode} />;
  if (entry.kind === "image") {
    return (
      <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface-variant flex items-center gap-2">
        <Icon name="file" size={14} />
        {t("imageChanged")}
      </p>
    );
  }
  const before = entry.before ?? "";
  const after = entry.after ?? "";
  const addedBox = <p className="rounded-control bg-success-soft px-3 py-2 text-body text-success whitespace-pre-wrap break-words">{after}</p>;
  const removedBox = <p className="rounded-control bg-error-container px-3 py-2 text-body text-error line-through whitespace-pre-wrap break-words">{before}</p>;
  // Hai cột: đoạn xoá ở cột bản cũ, đoạn thêm ở cột bản mới (cột kia để trống); màn hẹp về một cột
  if (entry.change === "added") return mode === "split" ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><span aria-hidden className="hidden md:block" />{addedBox}</div> : addedBox;
  if (entry.change === "removed") return mode === "split" ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{removedBox}<span aria-hidden className="hidden md:block" /></div> : removedBox;
  if (entry.change === "moved") {
    return (
      <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
        <span className="mr-2 inline-flex items-center gap-1 text-caption font-bold text-on-surface-muted">
          <Icon name="refresh" size={12} />
          {t("moved")}
        </span>
        {after || before}
      </p>
    );
  }
  if (mode === "split") {
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
          <Words before={before} after={after} side="old" />
        </p>
        <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
          <Words before={before} after={after} side="new" />
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
      <Words before={before} after={after} side="both" />
    </p>
  );
}

const ROW_STYLE: Record<string, string> = {
  added: "bg-success-soft text-success",
  removed: "bg-error-container text-error line-through",
  modified: "text-on-surface",
  moved: "text-on-surface",
};

function TableView({ table, mode }: { table: TableDiff; mode: DiffMode }) {
  const t = useTranslations("mode1.versionCompare");
  const columns = Math.max(table.header.length, ...table.rows.map((r) => (r.change === "unchanged" ? (r.rows[0]?.length ?? 0) : Math.max(r.before?.length ?? 0, r.after?.length ?? 0))));
  return (
    <div className="overflow-x-auto rounded-control bg-surface-container">
      <table className="w-full text-body">
        <thead>
          <tr className="text-left text-caption font-bold text-on-surface-variant">
            <th className="w-6" aria-hidden />
            {table.header.map((h, i) => (
              <th key={i} className="px-2 py-1.5">
                {table.header_before && table.header_before[i] !== h ? <Words before={table.header_before[i] ?? ""} after={h} side="both" /> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <RowGroup key={i} row={r} mode={mode} columns={columns} />
          ))}
        </tbody>
      </table>
      <span className="sr-only">{t("tableLabel")}</span>
    </div>
  );
}

function RowGroup({ row, mode, columns }: { row: TableRowDiff; mode: DiffMode; columns: number }) {
  const t = useTranslations("mode1.versionCompare");
  const [open, setOpen] = useState(false);
  if (row.change === "unchanged") {
    return (
      <>
        <tr>
          <td colSpan={columns + 1} className="px-2 py-1">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-caption font-bold text-primary hover:underline">
              {t("unchangedRows", { count: row.count })}
            </button>
          </td>
        </tr>
        {open &&
          row.rows.map((cells, i) => (
            <tr key={i} className="text-on-surface-variant">
              <td aria-hidden />
              {cells.map((c, j) => (
                <td key={j} className="px-2 py-1 align-top break-words">
                  {c}
                </td>
              ))}
            </tr>
          ))}
      </>
    );
  }
  const changed = new Set(row.cells_changed ?? []);
  const mark = row.change === "added" ? "+" : row.change === "removed" ? "−" : row.change === "modified" ? "~" : "↕";
  const markLabel = t(`row.${row.change}`);
  const cellsOf = (side: "old" | "new") => (side === "old" ? (row.before ?? []) : (row.after ?? []));
  const line = (side: "old" | "new" | "both") => {
    const cells = side === "old" ? cellsOf("old") : cellsOf("new");
    return Array.from({ length: Math.max(cells.length, row.before?.length ?? 0) }, (_, j) => {
      const isChanged = row.change === "modified" && changed.has(j);
      const content =
        isChanged && side === "both" ? (
          <Words before={row.before?.[j] ?? ""} after={row.after?.[j] ?? ""} side="both" />
        ) : isChanged ? (
          <Words before={row.before?.[j] ?? ""} after={row.after?.[j] ?? ""} side={side === "old" ? "old" : "new"} />
        ) : (
          (cells[j] ?? "")
        );
      return (
        <td key={j} className={`px-2 py-1 align-top break-words ${isChanged ? "bg-accent-gold-soft" : ""}`}>
          {content}
        </td>
      );
    });
  };
  const markCell = (label: string, symbol: string) => (
    <td className="px-1 py-1 text-center font-bold" title={label}>
      <span aria-hidden>{symbol}</span>
      <span className="sr-only">{label}</span>
    </td>
  );
  if (row.change === "modified" && mode === "split") {
    return (
      <>
        <tr className="text-on-surface-variant">
          {markCell(markLabel, "−")}
          {line("old")}
        </tr>
        <tr className="text-on-surface">
          {markCell(markLabel, "+")}
          {line("new")}
        </tr>
      </>
    );
  }
  return (
    <tr data-change={row.change} className={ROW_STYLE[row.change]}>
      {markCell(markLabel, mark)}
      {line(row.change === "removed" ? "old" : row.change === "modified" ? "both" : "new")}
    </tr>
  );
}
