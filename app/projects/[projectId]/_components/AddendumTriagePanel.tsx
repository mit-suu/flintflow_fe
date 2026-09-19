"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Op } from "@/types/pipeline";
import type { Addendum, Spine } from "@/types/spine";

interface AddendumTriagePanelProps {
  spine: Pick<Spine, "addendum">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

/** Phụ lục §5.4 Other Requirements — nơi những gì "để dành" đi về (S-7.4 sẽ nhặt). */
export const PARKED_SECTION = "fixed:5.4";

/**
 * Section một addendum có thể nhắm tới ở pha Brief. Nhãn ở `workspace.brief.section.<key>` — id section có
 * dấu chấm nên không làm khoá message được. `BriefSummaryCard` dùng chung bảng này.
 */
export const TARGET_OPTIONS = [
  { id: "fixed:1", key: "overview" },
  { id: "fixed:2.1", key: "actors" },
  { id: "fixed:3.1.2", key: "screenDesc" },
  { id: "fixed:4.2.2", key: "reliability" },
  { id: "fixed:4.2.3", key: "performance" },
  { id: PARKED_SECTION, key: "other" },
] as const;

export type BriefSectionKey = (typeof TARGET_OPTIONS)[number]["key"];

export const sectionKeyOf = (sectionId: string): BriefSectionKey | undefined =>
  TARGET_OPTIONS.find((option) => option.id === sectionId)?.key;

/** `fixed:4.2.2` ⇒ `§4.2.2`. */
const sectionNumber = (sectionId: string) => `§${sectionId.replace(/^fixed:/, "")}`;

export const buildRetargetOp = (id: string, target: string): Op => ({
  op: "set",
  path: `addendum[id=${id}].target_section`,
  value: target,
  reason: target === PARKED_SECTION ? "B-2.2 để dành sang phụ lục" : "B-2.2 đổi đích",
});

export const buildDropOp = (id: string): Op => ({
  op: "remove",
  path: `addendum[id=${id}]`,
  reason: "B-2.2 bỏ: nội dung không đúng",
});

/**
 * B-2.2 Addendum Triage: mỗi entry **giữ** (đúng đích), **để dành** (đổi đích sang §5.4, S-7.4 nhặt sau)
 * hoặc **bỏ** (chỉ khi nội dung sai).
 *
 * "Để dành" cố ý KHÔNG phải là xoá: step B-2.2 chỉ được ghi `addendum[]`/`assumptions[]` theo step
 * registry, nên chuyển sang phụ lục là đổi `target_section`, không phải chuyển collection. Nhờ vậy
 * thông tin không mất và vẫn quay lại được.
 *
 * Đây là lúc rẻ nhất để sửa `target_section`: sau S-2, addendum trỏ sai section thì đơn giản là không
 * tới tay step cần nó, và không có gì báo lỗi.
 */
export default function AddendumTriagePanel({ spine, onSubmitOps, busy = false }: AddendumTriagePanelProps) {
  const t = useTranslations("workspace.triage");
  const tBrief = useTranslations("workspace.brief");
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<string | null>(null);

  const entries = useMemo(
    () => [...spine.addendum].sort((a, b) => a.target_section.localeCompare(b.target_section) || a.id.localeCompare(b.id)),
    [spine.addendum]
  );

  const run = async (id: string, ops: Op[]) => {
    setPending(id);
    try {
      await onSubmitOps(ops);
    } finally {
      setPending(null);
      setConfirmDrop(null);
    }
  };

  if (entries.length === 0) {
    return <p className="text-[11.5px] text-[#6B6862]">{t("empty")}</p>;
  }

  const card = (entry: Addendum) => {
    const parked = entry.target_section === PARKED_SECTION;
    return (
      <li key={entry.id} className="rounded-[10px] border border-[#ECEAE5] bg-white p-2.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold text-[#191817]">{entry.topic || entry.id}</span>
          {parked && (
            <span className="text-[10px] font-bold text-[#6B6862] bg-[#F5F4F1] px-1.5 py-0.5 rounded-full shrink-0">
              {t("parked")}
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-[#191817]">{entry.content}</p>
        {entry.content_en && entry.content_en !== entry.content && (
          <p className="text-[10.5px] text-[#6B6862] italic">{entry.content_en}</p>
        )}

        <label className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[10.5px] font-bold text-[#8A867E] shrink-0">{t("moveTo")}</span>
          <select
            value={entry.target_section}
            disabled={busy || pending !== null}
            onChange={(e) => void run(entry.id, [buildRetargetOp(entry.id, e.target.value)])}
            className="flex-1 text-[11px] rounded-[8px] border border-[#ECEAE5] bg-white px-1.5 py-1 cursor-pointer disabled:opacity-50"
          >
            {TARGET_OPTIONS.some((o) => o.id === entry.target_section) ? null : (
              <option value={entry.target_section}>{entry.target_section}</option>
            )}
            {TARGET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {sectionNumber(o.id)} {tBrief(`section.${o.key}`)}
              </option>
            ))}
          </select>
        </label>

        {confirmDrop === entry.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-[#B91C1C] font-bold">{t("confirmDrop")}</span>
            <button
              type="button"
              disabled={busy || pending !== null}
              onClick={() => void run(entry.id, [buildDropOp(entry.id)])}
              className="px-2 py-1 rounded-full text-[10.5px] font-bold bg-[#B91C1C] text-white disabled:opacity-50 cursor-pointer"
            >
              {t("drop")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDrop(null)}
              className="px-2 py-1 rounded-full text-[10.5px] font-bold bg-white border border-[#ECEAE5] text-[#6B6862] cursor-pointer"
            >
              {t("keep")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || pending !== null}
            onClick={() => setConfirmDrop(entry.id)}
            className="self-start text-[10.5px] font-bold text-[#8A867E] underline disabled:opacity-50 cursor-pointer"
            title={t("dropHint")}
          >
            {t("dropEntry")}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] text-[#6B6862]">
        {t("intro", { count: entries.length })}
      </p>
      <ul className="flex flex-col gap-2">{entries.map(card)}</ul>
    </div>
  );
}
