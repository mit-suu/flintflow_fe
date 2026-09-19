"use client";

import { PHASES, PHASE_LABELS_VI, stepLabel, type PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";

interface StepProgressBarProps {
  steps: StepSummary[];
  progress: StepProgress | null;
  /** Step đang chọn để xem/chạy. */
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
=======
  /** Mode 1 v2 (FLF-185): step của đầu mục mẫu FPT file không có — nhãn đỏ "Thiếu" tới khi chốt. */
  missingStepIds?: ReadonlySet<string>;
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
}

const DOT_STYLE: Record<StepSummary["status"], string> = {
  accepted: "bg-[#1F7A45] text-white",
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
  in_progress: "bg-[#4F46E5] text-white animate-pulse",
  revision_requested: "bg-[#C7811B] text-white",
  pending: "bg-[#F0EEEA] text-[#A8A49C]",
=======
  in_progress: "bg-[#6A62C4] text-white animate-pulse",
  revision_requested: "bg-[#C7811B] text-white",
  pending: "bg-[#F0EEEA] text-[#A8A49C]",
  skipped: "bg-transparent border border-dashed border-[#D8D4CC] text-[#C9C4BA]",
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
};

/**
 * Thanh tiến độ đếm **step** (Phases §1.1): "Bước done/total". % chỉ hiện sau khi S-4.1 chốt N.
 * Step đã accepted bấm để xem; step kế tiếp bấm để chạy; step chưa tới bị khoá.
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
 */
export default function StepProgressBar({ steps, progress, selectedStepId, onSelectStep }: StepProgressBarProps) {
  const current = progress?.current_step ?? null;
=======
 * Danh sách step là của BE (`GET /steps`) — project mode 1 chỉ có step áp dụng cho template, phase rỗng bị ẩn.
 */
export default function StepProgressBar({ steps, progress, selectedStepId, onSelectStep, missingStepIds }: StepProgressBarProps) {
  const current = progress?.current_step ?? null;
  const isMissing = (step: StepSummary) => !!missingStepIds?.has(step.id) && step.status !== "accepted";
  const missingCount = steps.filter(isMissing).length;
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
  const percent = progress && progress.total > 0 ? Math.round((progress.done * 100) / progress.total) : 0;

  return (
    <div className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-4 shrink-0 overflow-x-auto" aria-label="Tiến độ theo bước">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase">Bước</span>
        <span className="text-[12px] font-bold text-[#191817]" data-testid="step-count">
          {progress ? `${progress.done}/${progress.total}` : "—"}
        </span>
        {progress?.show_percent && (
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
          <span className="text-[11px] font-bold text-[#4F46E5]" data-testid="step-percent">
            {percent}%
          </span>
        )}
=======
          <span className="text-[11px] font-bold text-[#6A62C4]" data-testid="step-percent">
            {percent}%
          </span>
        )}
        {missingCount > 0 && (
          <span
            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#FDEDED] text-[#B03030] border border-[#F2CACA]"
            data-testid="step-missing"
            title="Đầu mục mẫu FPT file upload không có — chạy step để AI soạn trước khi ký baseline v1"
          >
            Thiếu {missingCount}
          </span>
        )}
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
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
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
=======
                const missing = isMissing(step);
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectStep(step.id)}
<<<<<<< HEAD:app/projects/[projectId]/_components/StepProgressBar.tsx
                    aria-label={`${step.id} ${stepLabel(step.id)}`}
                    aria-current={isCurrent ? "step" : undefined}
                    title={`${step.id} · ${stepLabel(step.id)}`}
                    className={`h-2.5 rounded-full transition-all ${isCurrent ? "w-5" : "w-2.5"} ${DOT_STYLE[step.status]} ${
                      selectedStepId === step.id ? "ring-2 ring-[#4F46E5] ring-offset-1" : ""
=======
                    aria-label={`${step.id} ${stepLabel(step.id)}${missing ? " (Thiếu)" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    data-missing={missing || undefined}
                    title={`${step.id} · ${stepLabel(step.id)}${missing ? " — Thiếu: đầu mục FPT file không có" : ""}`}
                    className={`h-2.5 rounded-full transition-all ${isCurrent ? "w-5" : "w-2.5"} ${missing ? "bg-[#B03030] text-white" : DOT_STYLE[step.status]} ${
                      selectedStepId === step.id ? "ring-2 ring-[#6A62C4] ring-offset-1" : ""
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/StepProgressBar.tsx
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
