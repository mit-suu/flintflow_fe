"use client";

import { useEffect, useState } from "react";
import type { RunnerState } from "../hooks/useStepRunner";
import { formatDuration } from "./StepProgress";

/**
 * Lớp 5 "Chạy nền" (`03-live-status-flow.md`): thu tiến trình thành một pill ở góc màn hình để user đi
 * đọc tài liệu hay sang việc khác, mà vẫn biết **AI còn đang chạy và đã cần tới mình chưa**.
 *
 * Lượt test: user không dám rời máy vì không biết khi nào tới lượt mình. Pill nói đúng hai điều đó —
 * đang làm gì, và có cần bạn không.
 */

interface RunPillProps {
  state: RunnerState;
  onOpen: () => void;
  onCancel?: () => void;
}

export default function RunPill({ state, onOpen, onCancel }: RunPillProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!state.stepId) return null;
  const needsUser = state.status === "needs_input" || state.status === "gate_ready" || state.status === "error";
  const elapsed = state.startedAt ? now - state.startedAt : 0;
  const label = state.phase
    ? `${state.phase}${state.phaseProgress ? ` · bước ${state.phaseProgress.index}/${state.phaseProgress.total}` : ""}`
    : state.stepId;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] text-[12px] font-semibold cursor-pointer ${
        needsUser ? "bg-[#6A62C4] text-white" : "bg-[#191817] text-white"
      }`}
    >
      <span aria-hidden className={needsUser ? "" : "ff-spinner w-3 h-3 rounded-full border-2 border-white/40 border-t-white"} />
      <span>
        {label} · {needsUser ? "Đến lượt bạn" : (state.detail ?? "đang chạy")}
      </span>
      <span className="font-mono opacity-80">{formatDuration(elapsed)}</span>
      {!needsUser && onCancel && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Huỷ lượt đang chạy"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.stopPropagation();
            onCancel();
          }}
          className="ml-1 text-[11px] underline opacity-80 hover:opacity-100"
        >
          Huỷ
        </span>
      )}
    </button>
  );
}
