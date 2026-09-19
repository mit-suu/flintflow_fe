"use client";

import { useLocale, useTranslations } from "next-intl";
import { tPhase, tStep } from "@/lib/i18n";
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
  const t = useTranslations("workspace.phaseHeader");
  const locale = useLocale();
  const phaseLabel = currentPhase ? tPhase(currentPhase, locale) : t("done");

  return (
    <div className="bg-[#FAF9F7] border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-3 shrink-0 flex-wrap">
      <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase">Phase</span>
      <span className="text-[12.5px] font-extrabold text-[#191817]">
        {currentPhase ? `${currentPhase} · ${phaseLabel}` : phaseLabel}
      </span>
      {currentStep && (
        <span className="text-[11.5px] font-semibold text-[#4F46E5] bg-[#F4F3FE] border border-[#DDD9F6] px-2 py-0.5 rounded-full">
          {currentStep} · {tStep(currentStep, locale)}
        </span>
      )}
      {currentStep && onRunCurrentStep && (
        <button
          type="button"
          onClick={onRunCurrentStep}
          disabled={busy}
          className="px-3 py-1 rounded-full text-[11.5px] font-bold bg-[#191817] text-white hover:bg-[#33312D] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {t("runStep")}
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button type="button" disabled title={t("deepDive")} className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold border border-[#ECEAE5] text-[#A8A49C] cursor-not-allowed">
          [A]
        </button>
        <button type="button" disabled title={t("partyMode")} className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold border border-[#ECEAE5] text-[#A8A49C] cursor-not-allowed">
          [P]
        </button>
        <span className="text-[11px] font-bold text-[#6B6862]" title={t("changeModeHint")}>
          [C]
        </span>
        <WorkingModeSelect value={workingMode} onChange={onChangeWorkingMode} disabled={busy} />
      </div>
    </div>
  );
}
