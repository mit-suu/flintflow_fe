"use client";

import { useMemo, useState } from "react";
import type { Op } from "@/types/pipeline";
import type { Addendum, Spine } from "@/types/spine";
import { SECTION_LABEL } from "./brief-labels";

interface AddendumTriagePanelProps {
  spine: Pick<Spine, "addendum">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

/** Phụ lục §5.4 Other Requirements — nơi những gì "để dành" đi về (S-7.4 sẽ nhặt). */
export const PARKED_SECTION = "fixed:5.4";

/** Section một addendum có thể nhắm tới ở pha Brief. */
export const TARGET_OPTIONS: { id: string; label: string }[] = [
  { id: "fixed:1", label: "§1 Tổng quan sản phẩm" },
  { id: "fixed:2.1", label: "§2.1 Actor" },
  { id: "fixed:3.1.2", label: "§3.1.2 Mô tả màn" },
  { id: "fixed:4.2.2", label: "§4.2.2 Độ tin cậy" },
  { id: "fixed:4.2.3", label: "§4.2.3 Hiệu năng" },
  { id: PARKED_SECTION, label: "§5.4 Yêu cầu khác (để dành)" },
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
    return <p className="text-body text-on-surface-variant">Chưa có ghi chú nào từ pha Brief.</p>;
  }

  const card = (entry: Addendum) => {
    const parked = entry.target_section === PARKED_SECTION;
    return (
      <li key={entry.id} className="rounded-control bg-surface-container-low p-2.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {/* Tiêu đề là mục tài liệu đích bằng tiếng Việt — không hiện khoá `topic` thô (tiếng Anh) của model */}
          <span className="text-caption font-extrabold text-on-surface">{entry.topic === "vision" ? "Tầm nhìn" : entry.topic === "goals" ? "Mục tiêu" : (SECTION_LABEL[entry.target_section] ?? "Ghi chú")}</span>
          {parked && (
            <span className="text-caption font-bold text-on-surface-dark bg-surface-container-high px-1.5 py-0.5 rounded-full shrink-0">
              Để dành
            </span>
          )}
        </div>
        <p className="text-body text-on-surface">{entry.content}</p>

        <label className="flex items-center gap-1.5 pt-0.5">
          <span className="text-caption font-bold text-on-surface-variant shrink-0">Đưa vào</span>
          <select
            value={entry.target_section}
            disabled={busy || pending !== null}
            onChange={(e) => void run(entry.id, [buildRetargetOp(entry.id, e.target.value)])}
            className="flex-1 text-caption rounded-inner bg-surface-container-lowest px-1.5 py-1 cursor-pointer disabled:opacity-50"
          >
            {TARGET_OPTIONS.some((o) => o.id === entry.target_section) ? null : (
              <option value={entry.target_section}>Mục khác</option>
            )}
            {TARGET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {confirmDrop === entry.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-error font-bold">Bỏ hẳn vì nội dung sai?</span>
            <button
              type="button"
              disabled={busy || pending !== null}
              onClick={() => void run(entry.id, [buildDropOp(entry.id)])}
              className="px-2 py-1 rounded-full text-caption font-bold bg-error text-on-error hover:brightness-90 transition-[filter] disabled:opacity-50 cursor-pointer"
            >
              Bỏ
            </button>
            <button
              type="button"
              onClick={() => setConfirmDrop(null)}
              className="px-2 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-medium hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Thôi
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || pending !== null}
            onClick={() => setConfirmDrop(entry.id)}
            className="self-start text-caption font-bold text-on-surface-variant underline disabled:opacity-50 cursor-pointer"
            title="Chỉ bỏ khi nội dung sai — chưa làm bản này thì chọn Để dành ở ô trên"
          >
            Bỏ mục này
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-on-surface-variant">
        {entries.length} ghi chú. Đổi đích nếu đang nhắm sai chỗ; chọn §5.4 để dành lại cho bản sau. Chỉ bỏ khi nội dung
        sai.
      </p>
      <ul className="flex flex-col gap-2">{entries.map(card)}</ul>
    </div>
  );
}
