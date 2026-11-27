"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { BlockDiffEntry, TableDiff, TableRowDiff } from "@/types/import";
import { diffWords, type WordPart } from "./word-diff";

export type DiffMode = "unified" | "split";

/** Ngưỡng "viết lại gần hết": phần chữ giữ nguyên (không tính khoảng trắng) dưới 30% tổng chữ hai bản. */
const REWRITE_SAME_RATIO = 0.3;

/** Quá số chỗ đổi rời nhau này trong một đoạn ⇒ tô từng từ ra lốm đốm, đọc hai ô cũ / mới dễ hơn. */
const REWRITE_MAX_HUNKS = 3;

const isBlank = (s: string): boolean => !s.trim();

/**
 * Gom mỗi "chỗ đổi" (dãy phần đổi liền nhau, khoảng trắng chung không tách chỗ) thành: hết phần bỏ rồi hết phần thêm. LCS trả bỏ /
 * thêm xen kẽ từng từ ("within→return 2→in s→p95") — đọc như Track Changes thì phải là "within 2 s at p95" → "return in p95 < 800 ms".
 */
export const groupHunks = (parts: readonly WordPart[]): WordPart[] => {
  const out: WordPart[] = [];
  let del = "";
  let add = "";
  let gap = "";
  const flush = () => {
    if (del) out.push({ op: "del", text: del });
    if (add) out.push({ op: "add", text: add });
    if (gap) out.push({ op: "same", text: gap });
    del = add = gap = "";
  };
  for (const p of parts) {
    const inHunk = !!(del || add);
    if (p.op === "same" && isBlank(p.text) && inHunk) {
      gap += p.text;
      continue;
    }
    if (p.op === "same") {
      flush();
      out.push(p);
      continue;
    }
    // Khoảng trắng giữa hai phần đổi thuộc về cả bản cũ lẫn bản mới
    if (gap) {
      if (del) del += gap;
      if (add) add += gap;
      gap = "";
    }
    if (p.op === "del") del += p.text;
    else add += p.text;
  }
  flush();
  return out;
};

/**
 * Đoạn sửa coi là viết lại (không tô từng từ): chữ giữ nguyên ít hơn ngưỡng, hoặc đổi ở quá nhiều chỗ rời nhau. Nhận phần đã
 * gom (`groupHunks`).
 */
export const mostlyRewritten = (parts: readonly WordPart[]): boolean => {
  let same = 0;
  let total = 0;
  let hunks = 0;
  let inHunk = false;
  for (const p of parts) {
    const n = p.text.replace(/\s+/g, "").length;
    total += p.op === "same" ? 2 * n : n;
    if (p.op === "same") {
      same += 2 * n;
      if (n > 0) inHunk = false;
    } else if (!inHunk) {
      hunks++;
      inHunk = true;
    }
  }
  return total > 0 && (same / total < REWRITE_SAME_RATIO || hunks > REWRITE_MAX_HUNKS);
};

/**
 * Hai chữ trước / sau ⇒ một đoạn thay đổi: trước trống = thêm, sau trống = xoá, còn lại = sửa. Đề xuất sửa của change request và
 * thay đổi theo field đi qua đây để hiện y như so sánh version.
 */
export const textChange = (before: string, after: string): BlockDiffEntry => ({
  block_id: null,
  change: !before.trim() ? "added" : !after.trim() ? "removed" : "modified",
  before,
  after,
});

/** Chữ của một đoạn sửa, chỉ tô từ bị đổi: `old` = bản cũ (từ bị bỏ gạch đỏ), `new` = bản mới (từ thêm tô xanh), `both` = gộp. */
export function WordDiff({ before, after, side, parts }: { before: string; after: string; side: "both" | "old" | "new"; parts?: readonly WordPart[] }) {
  return (
    <>
      {(parts ?? groupHunks(diffWords(before, after))).map((p, i, all) => {
        if (p.op === "same") return <span key={i}>{p.text}</span>;
        if (p.op === "del") return side === "new" ? null : <del key={i} className="bg-error-container text-error rounded-sm">{p.text}</del>;
        // Chữ thêm ngay sau chữ bỏ (thay thế): cách ra một chút, không thì hai từ dính liền "specificationsstock"
        const afterDel = side === "both" && all[i - 1]?.op === "del";
        return side === "old" ? null : <ins key={i} className={`bg-success-soft text-success no-underline rounded-sm ${afterDel ? "ml-1" : ""}`}>{p.text}</ins>;
      })}
    </>
  );
}

/**
 * Một đoạn thay đổi kiểu so sánh version (UC-50): thêm = ô xanh, xoá = ô đỏ gạch ngang, sửa = một ô chỉ tô từ đổi (Hai cột:
 * bản cũ / bản mới). Dùng chung cho so sánh version, tải lại file và đề xuất sửa của change request.
 */
export default function BlockDiff({ entry, mode = "unified" }: { entry: BlockDiffEntry; mode?: DiffMode }) {
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
  const parts = groupHunks(diffWords(before, after));
  // Viết lại gần hết: tô từng từ ra cả ô lốm đốm, khó đọc hơn hai ô cũ / mới ⇒ hiện bản cũ gạch đỏ rồi bản mới
  if (mostlyRewritten(parts)) {
    return <div className={`grid grid-cols-1 gap-2 ${mode === "split" ? "md:grid-cols-2" : ""}`}>{removedBox}{addedBox}</div>;
  }
  if (mode === "split") {
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
          <WordDiff before={before} after={after} parts={parts} side="old" />
        </p>
        <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
          <WordDiff before={before} after={after} parts={parts} side="new" />
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-control bg-surface-container px-3 py-2 text-body text-on-surface whitespace-pre-wrap break-words">
      <WordDiff before={before} after={after} parts={parts} side="both" />
    </p>
  );
}

const ROW_STYLE: Record<string, string> = {
  added: "bg-success-soft text-success",
  removed: "bg-error-container text-error line-through",
  modified: "text-on-surface",
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
                {table.header_before && table.header_before[i] !== h ? <WordDiff before={table.header_before[i] ?? ""} after={h} side="both" /> : h}
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
  const mark = row.change === "added" ? "+" : row.change === "removed" ? "−" : "~";
  const markLabel = t(`row.${row.change}`);
  const cellsOf = (side: "old" | "new") => (side === "old" ? (row.before ?? []) : (row.after ?? []));
  const line = (side: "old" | "new" | "both") => {
    const cells = side === "old" ? cellsOf("old") : cellsOf("new");
    return Array.from({ length: Math.max(cells.length, row.before?.length ?? 0) }, (_, j) => {
      const isChanged = row.change === "modified" && changed.has(j);
      const content =
        isChanged && side === "both" ? (
          <WordDiff before={row.before?.[j] ?? ""} after={row.after?.[j] ?? ""} side="both" />
        ) : isChanged ? (
          <WordDiff before={row.before?.[j] ?? ""} after={row.after?.[j] ?? ""} side={side === "old" ? "old" : "new"} />
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
