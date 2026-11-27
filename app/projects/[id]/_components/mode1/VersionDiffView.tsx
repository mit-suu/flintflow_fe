"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { BlockDiffEntry, BlockDiffSummary, DiffSectionStat } from "@/types/import";
import BlockDiff, { type DiffMode } from "./BlockDiff";

export type { DiffMode };

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
                  <BlockDiff key={`${e.block_id ?? "b"}-${i}`} entry={e} mode={mode} />
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
