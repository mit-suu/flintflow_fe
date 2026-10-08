"use client";

import { useMemo, useState } from "react";
import type { Op } from "@/types/pipeline";
import { assumptionText } from "./brief-labels";
import type { Assumption, AssumptionStatus, Spine } from "@/types/spine";

interface AssumptionSweepPanelProps {
  spine: Pick<Spine, "assumptions">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

/** Giả định chạm ngưỡng NFR hoặc bất biến thì duyệt lẻ; còn lại duyệt lô được (Phases §5.4). */
const NEEDS_SINGLE_REVIEW = /^(nfrs|project\.(stakes|form_factor)|screens|functions)/;

export const needsSingleReview = (assumption: Pick<Assumption, "path">): boolean =>
  NEEDS_SINGLE_REVIEW.test(assumption.path);

/** `set status` + `confirmed_at` cho một giả định. `rejected` không có mốc xác nhận. */
export const buildDecisionOps = (id: string, status: Exclude<AssumptionStatus, "unconfirmed">, at: string): Op[] => [
  { op: "set", path: `assumptions[id=${id}].status`, value: status, reason: "B-2.1 Assumption Sweep" },
  {
    op: "set",
    path: `assumptions[id=${id}].confirmed_at`,
    value: status === "confirmed" ? at : null,
    reason: "B-2.1 Assumption Sweep",
  },
];

/**
 * B-2.1 Assumption Sweep (UC 2.9): duyệt `assumptions[status=unconfirmed]` lẻ hoặc cả lô.
 *
 * Danh sách đọc thẳng từ Spine — không suy từ nội dung tin nhắn. Giả định chạm ngưỡng NFR hoặc bất biến
 * bị tách riêng và **không** nằm trong nút duyệt lô: sai một cái là sai cả một chương.
 *
 * `rejected` nghĩa là giá trị đang dựa trên giả định đó sai, không phải "xoá dòng này" — nhãn nút nói
 * đúng như vậy để không ai bấm nhầm cho gọn danh sách.
 */
export default function AssumptionSweepPanel({ spine, onSubmitOps, busy = false }: AssumptionSweepPanelProps) {
  const [pending, setPending] = useState<string | null>(null);

  const unconfirmed = useMemo(() => spine.assumptions.filter((a) => a.status === "unconfirmed"), [spine.assumptions]);
  const single = unconfirmed.filter(needsSingleReview);
  const batchable = unconfirmed.filter((a) => !needsSingleReview(a));

  const decide = async (ids: string[], status: Exclude<AssumptionStatus, "unconfirmed">) => {
    if (ids.length === 0) return;
    setPending(ids.join(","));
    try {
      const at = new Date().toISOString();
      await onSubmitOps(ids.flatMap((id) => buildDecisionOps(id, status, at)));
    } finally {
      setPending(null);
    }
  };

  if (unconfirmed.length === 0) {
    return <p className="text-body text-on-surface-variant">Không còn điều nào chờ bạn xác nhận.</p>;
  }

  const row = (assumption: Assumption, solo: boolean) => (
    <li key={assumption.id} className="rounded-control bg-surface-container-low p-2.5 flex flex-col gap-1.5">
      {/* Không hiện path Spine thô (`project.form_factor`) — user đọc câu tạm hiểu và lý do bằng ngôn ngữ của mình */}
      <p className="text-body text-on-surface">{assumptionText(assumption)}</p>
      {(assumption.rationale_vi || assumption.rationale) && (
        <p className="text-caption text-on-surface-variant italic">{assumption.rationale_vi || assumption.rationale}</p>
      )}
      {solo && (
        <span className="self-start text-caption font-bold text-accent-gold-text bg-accent-gold-soft px-1.5 py-0.5 rounded-full">
          Cần duyệt riêng
        </span>
      )}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          disabled={busy || pending !== null}
          onClick={() => void decide([assumption.id], "confirmed")}
          className="px-2 py-1 rounded-full text-caption font-bold bg-primary text-on-primary hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          Đúng
        </button>
        <button
          type="button"
          disabled={busy || pending !== null}
          onClick={() => void decide([assumption.id], "rejected")}
          className="px-2 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50 cursor-pointer"
          title="Giá trị đang dựa trên giả định này sai — cần sửa lại chỗ đó"
        >
          Sai
        </button>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-on-surface-variant">
        {unconfirmed.length} giả định chờ xác nhận. Xác nhận đúng thì nội dung giữ nguyên; báo sai thì phần dựa trên nó
        cần sửa lại.
      </p>

      {batchable.length > 0 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy || pending !== null}
            onClick={() => void decide(batchable.map((a) => a.id), "confirmed")}
            className="px-2.5 py-1 rounded-full text-caption font-bold bg-primary text-on-primary hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            Xác nhận {batchable.length} giả định còn lại
          </button>
        </div>
      )}

      {single.length > 0 && (
        <ul className="flex flex-col gap-2">{single.map((a) => row(a, true))}</ul>
      )}
      {batchable.length > 0 && <ul className="flex flex-col gap-2">{batchable.map((a) => row(a, false))}</ul>}
    </div>
  );
}
