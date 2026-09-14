"use client";

import { PHASES, PHASE_LABELS_VI, stepLabel, type PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";

interface StepProgressBarProps {
  steps: StepSummary[];
  progress: StepProgress | null;
  /** Step đang chọn để xem/chạy. */
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}

const DOT_STYLE: Record<StepSummary["status"], string> = {
  accepted: "bg-[#1F7A45] text-white",
  in_progress: "bg-[#4F46E5] text-white animate-pulse",
  revision_requested: "bg-[#C7811B] text-white",
  pending: "bg-[#F0EEEA] text-[#A8A49C]",
};

/**
 * Thanh tiến độ đếm **step** (Phases §1.1): "Bước done/total". % chỉ hiện sau khi S-4.1 chốt N.
 * Step đã accepted bấm để xem; step kế tiếp bấm để chạy; step chưa tới bị khoá.
 */
export default function StepProgressBar({ steps, progress, selectedStepId, onSelectStep }: StepProgressBarProps) {
  const current = progress?.current_step ?? null;
  const percent = progress && progress.total > 0 ? Math.round((progress.done * 100) / progress.total) : 0;

  return (
    <div className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-4 shrink-0 overflow-x-auto" aria-label="Tiến độ theo bước">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase">Bước</span>
        <span className="text-[12px] font-bold text-[#191817]" data-testid="step-count">
          {progress ? `${progress.done}/${progress.total}` : "—"}
        </span>
        {progress?.show_percent && (
          <span className="text-[11px] font-bold text-[#4F46E5]" data-testid="step-percent">
            {percent}%
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {PHASES.map((phase: PhaseId) => {
          const phaseSteps = steps.filter((s) => s.phase === phase);
          if (phaseSteps.length === 0) return null;
          return (
            <div key={phase} className="flex items-center gap-1 shrink-0" title={PHASE_LABELS_VI[phase]}>
              <span className="text-[10px] font-bold text-[#8A867E] mr-0.5">{phase}</span>
              {phaseSteps.map((step) => {
                const isCurrent = step.id === current;
                const clickable = step.status === "accepted" || isCurrent || step.status === "revision_requested";
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectStep(step.id)}
                    aria-label={`${step.id} ${stepLabel(step.id)}`}
                    aria-current={isCurrent ? "step" : undefined}
                    title={`${step.id} · ${stepLabel(step.id)}`}
                    className={`h-2.5 rounded-full transition-all ${isCurrent ? "w-5" : "w-2.5"} ${DOT_STYLE[step.status]} ${
                      selectedStepId === step.id ? "ring-2 ring-[#4F46E5] ring-offset-1" : ""
                    } ${clickable ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
