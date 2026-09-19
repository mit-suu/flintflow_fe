"use client";

import { useLocale, useTranslations } from "next-intl";
import { PHASES, type PhaseId } from "@/lib/constants/step-registry";
import { tPhase } from "@/lib/i18n";
import type { StepSummary } from "@/types/pipeline";

interface PhaseNavBarProps {
  currentPhase: string | null;
  steps: StepSummary[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onExportClick: () => void;
  exportActive?: boolean;
  onVerificationClick?: () => void;
  verificationOpen?: boolean;
  verificationFlagsCount?: number;
  /** Điểm sẵn sàng (% section accepted) — hiển thị, không phải điều kiện chốt. */
  readinessPercent?: number;
}

export type PhaseState = "completed" | "active" | "upcoming";

/** Phase xong khi mọi step của nó accepted; phase đang chạy là `current_phase`. */
export const phaseState = (phase: PhaseId, currentPhase: string | null, steps: StepSummary[]): PhaseState => {
  const phaseSteps = steps.filter((s) => s.phase === phase);
  if (phaseSteps.length > 0 && phaseSteps.every((s) => s.status === "accepted")) return "completed";
  if (phase === currentPhase) return "active";
  return "upcoming";
};

/** 12 phase B-0…S-9 theo step registry (Phases §1.1). */
export default function PhaseNavBar({
  currentPhase,
  steps,
  sidebarOpen,
  onToggleSidebar,
  onExportClick,
  exportActive = false,
  onVerificationClick,
  verificationOpen = false,
  verificationFlagsCount = 0,
  readinessPercent,
}: PhaseNavBarProps) {
  const t = useTranslations("workspace.phaseNav");
  const locale = useLocale();

  return (
    <nav className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-3 shrink-0 h-[52px] overflow-x-auto scrollbar-hide z-10">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 hover:bg-[#FAF9F7] rounded-[8px] text-[#6B6862] transition-colors shrink-0 cursor-pointer"
        title={t("toggleSidebar")}
      >
        <span className="material-symbols-outlined text-[18px]">{sidebarOpen ? "menu_open" : "menu"}</span>
      </button>

      <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase shrink-0 mr-1">PHASE</span>

      <ol className="flex items-center gap-1.5 shrink-0">
        {PHASES.map((phase) => {
          const state = phaseState(phase, currentPhase, steps);
          const style =
            state === "completed"
              ? "bg-[#E9F7EE] text-[#1F7A45] border border-[#BFE6CE]"
              : state === "active"
                ? "bg-[#191817] text-white shadow-sm"
                : "bg-[#FAF9F7] text-[#A8A49C] border border-[#ECEAE5]";
          return (
            <li
              key={phase}
              title={tPhase(phase, locale)}
              aria-current={state === "active" ? "step" : undefined}
              data-state={state}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${style}`}
            >
              {state === "completed" && <span className="text-[10px]">✓</span>}
              <span>{phase}</span>
            </li>
          );
        })}
      </ol>

      <div className="w-[1px] h-5 bg-[#E4E1DC] mx-1 shrink-0" />

      {/* Export luôn bấm được, không khoá theo tiến độ (Phases §6.5) */}
      <button
        onClick={onExportClick}
        className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
          exportActive ? "bg-[#191817] text-white shadow-sm" : "bg-[#F4F3FE] text-[#4F46E5] border border-[#DDD9F6] hover:bg-[#EDEAFB]"
        }`}
        title={t("exportHint")}
      >
        <span>★</span>
        <span>Export & Handoff</span>
      </button>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        {onVerificationClick && (
          <button
            onClick={onVerificationClick}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              verificationOpen ? "bg-[#FBF4E4] border border-[#F0DFB4] text-[#8A6D1F]" : "bg-white border border-[#ECEAE5] text-[#6B6862] hover:bg-[#FAF9F7]"
            }`}
            title={t("verificationHint")}
          >
            <span>{verificationFlagsCount > 0 ? "⚠" : "✓"}</span>
            <span>
              Verification
              {verificationFlagsCount > 0 && ` (${verificationFlagsCount})`}
            </span>
          </button>
        )}
        {readinessPercent !== undefined && (
          <span className="text-[11.5px] font-bold text-[#6B6862]" title={t("readinessHint")}>
            {readinessPercent}% accepted
          </span>
        )}
      </div>
    </nav>
  );
}
