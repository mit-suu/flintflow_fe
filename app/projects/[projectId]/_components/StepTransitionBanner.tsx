"use client";

import { DISCOVERY_STEPS, DiscoveryStepNumber } from "../../../../lib/constants/section-types";

interface StepTransitionBannerProps {
  currentStep: DiscoveryStepNumber;
  stepSummary?: string;
  onContinue: () => void;
  onStayHere: () => void;
}

export default function StepTransitionBanner({
  currentStep,
  stepSummary,
  onContinue,
  onStayHere,
}: StepTransitionBannerProps) {
  const nextStep = currentStep < 6 ? (currentStep + 1) as DiscoveryStepNumber : null;
  const currentStepInfo = DISCOVERY_STEPS[currentStep - 1];
  const nextStepInfo = nextStep ? DISCOVERY_STEPS[nextStep - 1] : null;

  return (
    <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_4px_16px_rgba(34,197,94,0.10)] animate-[fadeInUp_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-[10px] bg-[#22C55E] text-white flex items-center justify-center text-sm shrink-0 shadow-sm">
          ✓
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-extrabold text-[#15803D] leading-tight">
            Step {currentStep} ({currentStepInfo?.shortLabel}) đã đủ thông tin!
          </span>
          {stepSummary && (
            <p className="text-[11.5px] text-[#166534] leading-relaxed mt-0.5 italic">
              &ldquo;{stepSummary}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#BBF7D0]">
        {nextStepInfo && (
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 px-3 py-2 rounded-[10px] bg-[#22C55E] hover:bg-[#16A34A] text-white text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <span>Tiếp tục Step {nextStep}</span>
            <span className="text-sm">→</span>
          </button>
        )}
        <button
          type="button"
          onClick={onStayHere}
          className="px-3 py-2 rounded-[10px] bg-white hover:bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D] text-[11.5px] font-semibold transition-all cursor-pointer"
        >
          Bổ sung thêm
        </button>
      </div>
    </div>
  );
}
