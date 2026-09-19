"use client";

import { PHASE_LABELS_VI, stepLabel, type PhaseId } from "@/lib/constants/step-registry";
import type { WorkingMode } from "@/types/spine";
import WorkingModeSelect from "./WorkingModeSelect";

interface PhaseHeaderProps {
  currentPhase: string | null;
  currentStep: string | null;
  workingMode: WorkingMode | null;
  onChangeWorkingMode: (mode: WorkingMode) => void;
  onRunCurrentStep?: () => void;
  busy?: boolean;
}

/** Phase hiện tại + menu đào sâu: [A]/[P] vòng sau, [C] đổi cách làm việc. */
export default function PhaseHeader({
  currentPhase,
  currentStep,
  workingMode,
  onChangeWorkingMode,
  onRunCurrentStep,
  busy = false,
}: PhaseHeaderProps) {
  const phaseLabel = currentPhase ? (PHASE_LABELS_VI[currentPhase as PhaseId] ?? currentPhase) : "Hoàn tất";

  return (
    <div className="bg-[#FAF9F7] border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-3 shrink-0 flex-wrap">
      <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase">Phase</span>
      <span className="text-[12.5px] font-extrabold text-[#191817]">
        {currentPhase ? `${currentPhase} · ${phaseLabel}` : phaseLabel}
      </span>
      {currentStep && (
<<<<<<< HEAD:app/projects/[projectId]/_components/PhaseHeader.tsx
        <span className="text-[11.5px] font-semibold text-[#4F46E5] bg-[#F4F3FE] border border-[#DDD9F6] px-2 py-0.5 rounded-full">
=======
        <span className="text-[11.5px] font-semibold text-[#6A62C4] bg-[#F2F1FB] border border-[#DCD8F0] px-2 py-0.5 rounded-full">
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/PhaseHeader.tsx
          {currentStep} · {stepLabel(currentStep)}
        </span>
      )}
      {currentStep && onRunCurrentStep && (
        <button
          type="button"
          onClick={onRunCurrentStep}
          disabled={busy}
          className="px-3 py-1 rounded-full text-[11.5px] font-bold bg-[#191817] text-white hover:bg-[#33312D] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          ▶ Chạy bước này
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button type="button" disabled title="Đào sâu (vòng sau)" className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold border border-[#ECEAE5] text-[#A8A49C] cursor-not-allowed">
          [A]
        </button>
        <button type="button" disabled title="Party Mode (vòng sau)" className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold border border-[#ECEAE5] text-[#A8A49C] cursor-not-allowed">
          [P]
        </button>
        <span className="text-[11px] font-bold text-[#6B6862]" title="Đổi cách làm việc ở ranh giới phase">
          [C]
        </span>
        <WorkingModeSelect value={workingMode} onChange={onChangeWorkingMode} disabled={busy} />
      </div>
    </div>
  );
}
