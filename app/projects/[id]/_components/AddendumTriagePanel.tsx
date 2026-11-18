"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Op } from "@/types/pipeline";
import type { Addendum, Spine } from "@/types/spine";
import { sectionLabel } from "./brief-labels";

interface AddendumTriagePanelProps {
  spine: Pick<Spine, "addendum">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

/** Phụ lục §5.4 Other Requirements — nơi những gì "để dành" đi về (S-7.4 sẽ nhặt). */
export const PARKED_SECTION = "fixed:5.4";

/** Section một addendum có thể nhắm tới ở pha Brief — nhãn `§<number> <tên mục>` (tên theo `sectionLabel`). */
export const TARGET_OPTIONS: { id: string; number: string }[] = [
  { id: "fixed:1", number: "1" },
  { id: "fixed:2.1", number: "2.1" },
  { id: "fixed:3.1.2", number: "3.1.2" },
  { id: "fixed:4.2.2", number: "4.2.2" },
  { id: "fixed:4.2.3", number: "4.2.3" },
  { id: PARKED_SECTION, number: "5.4" },
];

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
  const tLabel = useTranslations("workspace.briefLabels");
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
    return <p className="text-body text-on-surface-variant">{t("empty")}</p>;
  }

  const card = (entry: Addendum) => {
    const parked = entry.target_section === PARKED_SECTION;
    return (
      <li key={entry.id} className="rounded-control bg-surface-container-low p-2.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {/* Tiêu đề là mục tài liệu đích bằng tiếng Việt — không hiện khoá `topic` thô (tiếng Anh) của model */}
          <span className="text-caption font-extrabold text-on-surface">{entry.topic === "vision" ? t("vision") : entry.topic === "goals" ? t("goals") : (sectionLabel(entry.target_section, tLabel) ?? t("note"))}</span>
          {parked && (
            <span className="text-caption font-bold text-on-surface-dark bg-surface-container-high px-1.5 py-0.5 rounded-full shrink-0">
              {t("parked")}
            </span>
          )}
        </div>
        <p className="text-body text-on-surface">{entry.content}</p>

        <label className="flex items-center gap-1.5 pt-0.5">
          <span className="text-caption font-bold text-on-surface-variant shrink-0">{t("moveTo")}</span>
          <select
            value={entry.target_section}
            disabled={busy || pending !== null}
            onChange={(e) => void run(entry.id, [buildRetargetOp(entry.id, e.target.value)])}
            className="flex-1 text-caption rounded-inner bg-surface-container-lowest px-1.5 py-1 cursor-pointer disabled:opacity-50"
          >
            {TARGET_OPTIONS.some((o) => o.id === entry.target_section) ? null : (
              <option value={entry.target_section}>{tLabel("otherSection")}</option>
            )}
            {TARGET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {t("target", { number: o.number, label: sectionLabel(o.id, tLabel) ?? o.id })}
              </option>
            ))}
          </select>
        </label>

        {confirmDrop === entry.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-error font-bold">{t("confirmDrop")}</span>
            <button
              type="button"
              disabled={busy || pending !== null}
              onClick={() => void run(entry.id, [buildDropOp(entry.id)])}
              className="px-2 py-1 rounded-full text-caption font-bold bg-error text-on-error hover:brightness-90 transition-[filter] disabled:opacity-50 cursor-pointer"
            >
              {t("drop")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDrop(null)}
              className="px-2 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-medium hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              {t("keep")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || pending !== null}
            onClick={() => setConfirmDrop(entry.id)}
            className="self-start text-caption font-bold text-on-surface-variant underline disabled:opacity-50 cursor-pointer"
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
      <p className="text-caption text-on-surface-variant">{t("intro", { count: entries.length })}</p>
      <ul className="flex flex-col gap-2">{entries.map(card)}</ul>
    </div>
  );
}
