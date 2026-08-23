"use client";

import {
  DISCOVERY_STEPS,
  DiscoveryStepNumber,
} from "../../../../lib/constants/section-types";

interface DiscoveryStepBarProps {
  currentStep: DiscoveryStepNumber;
  completedSteps?: DiscoveryStepNumber[];
  onStepClick: (step: DiscoveryStepNumber) => void;
}

export default function DiscoveryStepBar({
  currentStep,
  completedSteps = [],
  onStepClick,
}: DiscoveryStepBarProps) {
  return (
    <div className="bg-[#FAF9F7] border-b border-[#ECEAE5] px-6 py-2 flex items-center justify-between shrink-0 h-[44px] overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 min-w-max">
        <span className="text-[10px] font-extrabold text-[#4F46E5] uppercase tracking-wider px-2 py-0.5 bg-[#F4F3FE] rounded-[6px] mr-2">
          Discovery Brief
        </span>

        {DISCOVERY_STEPS.map((stepInfo, idx) => {
          const isCurrent = currentStep === stepInfo.step;
          const isDone =
            completedSteps.includes(stepInfo.step) ||
            stepInfo.step < currentStep;

          return (
            <div key={stepInfo.step} className="flex items-center">
              <button
                onClick={() => onStepClick(stepInfo.step)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-white text-[#3B34B0] border border-[#DDD9F6] shadow-sm"
                    : isDone
                    ? "text-[#1F7A45] hover:bg-white/80"
                    : "text-[#8A867E] hover:bg-white/60"
                }`}
                title={stepInfo.description}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 ${
                    isCurrent
                      ? "bg-[#4F46E5] text-white"
                      : isDone
                      ? "bg-[#E9F7EE] text-[#1F7A45]"
                      : "bg-[#E4E1DC] text-[#6B6862]"
                  }`}
                >
                  {isDone ? "✓" : stepInfo.step}
                </span>
                <span className="truncate max-w-[130px]">
                  {stepInfo.shortLabel}
                </span>
              </button>

              {idx < DISCOVERY_STEPS.length - 1 && (
                <span className="text-[#D6D2CB] mx-1 text-xs select-none">
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center text-[10.5px] text-[#8A867E] ml-4 shrink-0 italic">
        Bước {currentStep}/6: {DISCOVERY_STEPS[currentStep - 1]?.label}
      </div>
    </div>
  );
}
