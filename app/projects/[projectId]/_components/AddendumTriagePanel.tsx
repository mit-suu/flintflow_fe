"use client";

import { useMemo, useState } from "react";
import type { Op } from "@/types/pipeline";
import type { Addendum, Spine } from "@/types/spine";

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
    return <p className="text-[11.5px] text-[#6B6862]">Chưa có ghi chú nào từ pha Brief.</p>;
  }

  const card = (entry: Addendum) => {
    const parked = entry.target_section === PARKED_SECTION;
    return (
      <li key={entry.id} className="rounded-[10px] border border-[#ECEAE5] bg-white p-2.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold text-[#191817]">{entry.topic || entry.id}</span>
          {parked && (
            <span className="text-[10px] font-bold text-[#6B6862] bg-[#F5F4F1] px-1.5 py-0.5 rounded-full shrink-0">
              Để dành
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-[#191817]">{entry.content}</p>
        {entry.content_en && entry.content_en !== entry.content && (
          <p className="text-[10.5px] text-[#6B6862] italic">{entry.content_en}</p>
        )}

        <label className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[10.5px] font-bold text-[#8A867E] shrink-0">Đưa vào</span>
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
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {confirmDrop === entry.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-[#B91C1C] font-bold">Bỏ hẳn vì nội dung sai?</span>
            <button
              type="button"
              disabled={busy || pending !== null}
              onClick={() => void run(entry.id, [buildDropOp(entry.id)])}
              className="px-2 py-1 rounded-full text-[10.5px] font-bold bg-[#B91C1C] text-white disabled:opacity-50 cursor-pointer"
            >
              Bỏ
            </button>
            <button
              type="button"
              onClick={() => setConfirmDrop(null)}
              className="px-2 py-1 rounded-full text-[10.5px] font-bold bg-white border border-[#ECEAE5] text-[#6B6862] cursor-pointer"
            >
              Thôi
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || pending !== null}
            onClick={() => setConfirmDrop(entry.id)}
            className="self-start text-[10.5px] font-bold text-[#8A867E] underline disabled:opacity-50 cursor-pointer"
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
      <p className="text-[11px] text-[#6B6862]">
        {entries.length} ghi chú. Đổi đích nếu đang nhắm sai chỗ; chọn §5.4 để dành lại cho bản sau. Chỉ bỏ khi nội dung
        sai.
      </p>
      <ul className="flex flex-col gap-2">{entries.map(card)}</ul>
    </div>
  );
}
