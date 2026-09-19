"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { REGENERATE_LIMIT } from "@/lib/constants/step-registry";
import { tStep } from "@/lib/i18n";
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
  const t = useTranslations("workspace.gate");
  const locale = useLocale();
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
    <div className="bg-white border-2 border-[#DDD9F6] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(79,70,229,0.08)]" aria-label={t("title")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold text-[#4F46E5] tracking-wider uppercase">{t("title")}</div>
          <h4 className="font-extrabold text-[13px] text-[#191817]">{phaseLabel ?? `${stepId} · ${tStep(stepId, locale)}`}</h4>
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
          title={regenerateLeft ? undefined : t("noRegenerate")}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DDD9F6] text-[#4F46E5] hover:bg-[#F4F3FE] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            {mode === "revision" ? t("revisionLabel") : t("acceptAsIsLabel")}
          </label>
          <textarea
            id={`gate-note-${stepId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#4F46E5] rounded-[10px] text-[12px] outline-none resize-none"
          />
          <button
            type="button"
            disabled={!canSubmitNote}
            onClick={submitNote}
            className="self-end px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mode === "revision" ? t("sendRevision") : t("confirmAcceptAsIs")}
          </button>
        </div>
      )}
    </div>
  );
}
