"use client";

import { useEffect } from "react";
import type { Change } from "@/types/spine";
import { describeChange } from "./describe-change";

interface EditHistoryProps {
  history: Change[];
  loading: boolean;
  /** Tải 20 thay đổi gần nhất (`GET /changes`). */
  onLoad: () => void;
}

const timeOf = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

/** Lịch sử sửa gần đây, viết thành câu dễ đọc (mới nhất trước) — thay cho danh sách op thô của Change panel cũ. */
export default function EditHistory({ history, loading, onLoad }: EditHistoryProps) {
  useEffect(() => {
    onLoad();
  }, [onLoad]);

  if (loading) return <p className="text-[11.5px] text-on-surface-subtle italic">Đang tải…</p>;
  if (history.length === 0) return <p className="text-[11.5px] text-on-surface-subtle italic">Chưa có lần sửa nào.</p>;

  return (
    <ul className="flex flex-col gap-1">
      {[...history].reverse().map((change) => (
        <li key={`${change.txn}:${change.seq}`} className="rounded-inner bg-surface-container-lowest px-2.5 py-1.5 flex flex-col gap-0.5">
          <span className="text-[11.5px] text-on-surface leading-relaxed break-words">{describeChange(change)}</span>
          <span className="text-[10.5px] text-on-surface-subtle">
            {timeOf(change.at)} · {change.step_id ? `bước ${change.step_id}` : "lệnh sửa"}
          </span>
        </li>
      ))}
    </ul>
  );
}
