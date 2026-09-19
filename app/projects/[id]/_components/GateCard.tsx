"use client";

import { useState } from "react";
import { REGENERATE_LIMIT, stepLabel } from "@/lib/constants/step-registry";
import type { GateAction } from "@/types/pipeline";

interface GateCardProps {
  stepId: string;
  /** Hành động BE cho phép (sự kiện `gate_ready`). */
  actions: GateAction[];
  regenerateUsed: number;
  regenerateLimit?: number;
  busy?: boolean;
  /** Fast path: một GateCard gộp cuối phase. */
  phaseLabel?: string;
  onAction: (action: GateAction, note?: string) => void;
}

/**
 * Cổng chốt (Phases §3): Accept · Request revision (ghi chú) · Regenerate (n/3, tắt khi hết) ·
 * Accept as-is (chỉ khi hết Regenerate hoặc BE mở, bắt buộc lý do).
 */
export default function GateCard({
  stepId,
  actions,
  regenerateUsed,
  regenerateLimit = REGENERATE_LIMIT,
  busy = false,
  phaseLabel,
  onAction,
}: GateCardProps) {
  const [mode, setMode] = useState<"revision" | "accept_as_is" | null>(null);
  const [note, setNote] = useState("");

  const regenerateLeft = regenerateUsed < regenerateLimit && actions.includes("regenerate");
  const showAcceptAsIs = actions.includes("accept_as_is") || regenerateUsed >= regenerateLimit;
  const noteRequired = mode !== null;
  const canSubmitNote = note.trim().length > 0 && !busy;

  const submitNote = () => {
    if (!mode || !canSubmitNote) return;
    onAction(mode, note.trim());
    setNote("");
    setMode(null);
  };

  return (
<<<<<<< HEAD:app/projects/[projectId]/_components/GateCard.tsx
    <div className="bg-white border-2 border-[#DDD9F6] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(79,70,229,0.08)]" aria-label="Cổng chốt">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold text-[#4F46E5] tracking-wider uppercase">Cổng chốt</div>
=======
    <div className="bg-white border-2 border-[#DCD8F0] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(106,98,196,0.08)]" aria-label="Cổng chốt">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold text-[#6A62C4] tracking-wider uppercase">Cổng chốt</div>
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/GateCard.tsx
          <h4 className="font-extrabold text-[13px] text-[#191817]">{phaseLabel ?? `${stepId} · ${stepLabel(stepId)}`}</h4>
        </div>
        <span className="text-[11px] font-bold text-[#6B6862]" data-testid="regenerate-count">
          Regenerate {regenerateUsed}/{regenerateLimit}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !actions.includes("accept")}
          onClick={() => onAction("accept")}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#1F7A45] text-white hover:bg-[#19663A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✓ Accept
        </button>
        <button
          type="button"
          disabled={busy || !actions.includes("revision")}
          onClick={() => setMode(mode === "revision" ? null : "revision")}
          aria-pressed={mode === "revision"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✎ Request revision
        </button>
        <button
          type="button"
          disabled={busy || !regenerateLeft}
          onClick={() => onAction("regenerate")}
          title={regenerateLeft ? undefined : "Đã hết lượt Regenerate"}
<<<<<<< HEAD:app/projects/[projectId]/_components/GateCard.tsx
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DDD9F6] text-[#4F46E5] hover:bg-[#F4F3FE] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
=======
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DCD8F0] text-[#6A62C4] hover:bg-[#F2F1FB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/GateCard.tsx
        >
          ↻ Regenerate ({regenerateUsed}/{regenerateLimit})
        </button>
        {showAcceptAsIs && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === "accept_as_is" ? null : "accept_as_is")}
            aria-pressed={mode === "accept_as_is"}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#F0DFB4] text-[#8A6D1F] bg-[#FBF4E4] hover:bg-[#F7EBCF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Accept as-is
          </button>
        )}
      </div>

      {noteRequired && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`gate-note-${stepId}`} className="text-[11.5px] font-semibold text-[#6B6862]">
            {mode === "revision" ? "Cần sửa gì?" : "Lý do chấp nhận bản hiện tại (bắt buộc)"}
          </label>
          <textarea
            id={`gate-note-${stepId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
<<<<<<< HEAD:app/projects/[projectId]/_components/GateCard.tsx
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#4F46E5] rounded-[10px] text-[12px] outline-none resize-none"
=======
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#6A62C4] rounded-[10px] text-[12px] outline-none resize-none"
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/GateCard.tsx
          />
          <button
            type="button"
            disabled={!canSubmitNote}
            onClick={submitNote}
            className="self-end px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mode === "revision" ? "Gửi yêu cầu sửa" : "Xác nhận Accept as-is"}
          </button>
        </div>
      )}
    </div>
  );
}
