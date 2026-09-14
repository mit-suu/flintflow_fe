"use client";

import {
  WorkspacePhase,
  WORKSPACE_PHASES,
  PHASE_SECTION_MAP,
  SectionType,
} from "../../../../lib/constants/section-types";
import type { SectionItem } from "@/types/document";

interface PhaseNavBarProps {
  currentPhase: WorkspacePhase;
  sections: SectionItem[];
  progressPercent: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPhaseClick: (phase: WorkspacePhase) => void;
  onVerificationClick?: () => void;
  verificationOpen?: boolean;
  verificationFlagsCount?: number;
}

export default function PhaseNavBar({
  currentPhase,
  sections,
  progressPercent,
  sidebarOpen,
  onToggleSidebar,
  onPhaseClick,
  onVerificationClick,
  verificationOpen = false,
  verificationFlagsCount = 0,
}: PhaseNavBarProps) {
  // Helper to determine phase status
  const getPhaseStatus = (
    phaseId: WorkspacePhase
  ): "completed" | "active" | "locked" => {
    if (phaseId === currentPhase) return "active";

    if (phaseId === "discovery") {
      // Completed if we have progressed past discovery
      return currentPhase !== "discovery" ? "completed" : "active";
    }

    const phaseSections = PHASE_SECTION_MAP[phaseId];
    if (!phaseSections || phaseSections.length === 0) return "locked";

    const acceptedCount = sections.filter(
      (s) =>
        phaseSections.includes(s.type as SectionType) &&
        s.status === "accepted"
    ).length;

    if (acceptedCount === phaseSections.length) return "completed";

    // Check if phase is reachable based on order
    const currentPhaseInfo = WORKSPACE_PHASES.find(
      (p) => p.id === currentPhase
    );
    const targetPhaseInfo = WORKSPACE_PHASES.find((p) => p.id === phaseId);

    if (
      currentPhaseInfo &&
      targetPhaseInfo &&
      targetPhaseInfo.order <= currentPhaseInfo.order
    ) {
      return "active";
    }

    return "locked";
  };

  return (
    <nav className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-3 shrink-0 h-[52px] overflow-x-auto scrollbar-hide z-10">
      {/* Sidebar toggle button */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 hover:bg-[#FAF9F7] rounded-[8px] text-[#6B6862] transition-colors shrink-0 cursor-pointer"
        title="Toggle Lịch sử phiên chat"
      >
        <span className="material-symbols-outlined text-[18px]">
          {sidebarOpen ? "menu_open" : "menu"}
        </span>
      </button>

      {/* Label PHASE */}
      <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase shrink-0 mr-1">
        PHASE
      </span>

      {/* 4 Core Phase Pills */}
      <div className="flex items-center gap-2 shrink-0">
        {WORKSPACE_PHASES.filter((p) => p.id !== "export").map((phase) => {
          const status = getPhaseStatus(phase.id);
          const isActive = currentPhase === phase.id;

          let pillStyle = "bg-[#F0EEEA] text-[#6B6862] hover:bg-[#EAE8E3]";
          let icon = <span className="w-1.5 h-1.5 rounded-full bg-[#A8A49C]" />;

          if (status === "completed") {
            pillStyle =
              "bg-[#E9F7EE] text-[#1F7A45] hover:bg-[#DCF2E4] border border-[#BFE6CE]";
            icon = <span className="text-[11px] font-bold">✓</span>;
          } else if (isActive) {
            pillStyle =
              "bg-[#191817] text-white shadow-sm hover:bg-[#2A2928]";
            icon = (
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] ring-2 ring-white/30" />
            );
          } else if (status === "locked") {
            pillStyle = "bg-[#FAF9F7] text-[#A8A49C] border border-[#ECEAE5] cursor-not-allowed opacity-75";
            icon = <span className="w-1.5 h-1.5 rounded-full bg-[#D6D2CB]" />;
          }

          return (
            <button
              key={phase.id}
              onClick={() => {
                if (status !== "locked") {
                  onPhaseClick(phase.id);
                }
              }}
              disabled={status === "locked"}
              className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${pillStyle}`}
              title={phase.description}
            >
              {icon}
              <span>{phase.label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-[1px] h-5 bg-[#E4E1DC] mx-1 shrink-0" />

      {/* Export Pill — luôn bấm được, không khoá theo % tiến độ */}
      <button
        onClick={() => onPhaseClick("export")}
        className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
          currentPhase === "export"
            ? "bg-[#191817] text-white shadow-sm"
            : "bg-[#F4F3FE] text-[#4F46E5] border border-[#DDD9F6] hover:bg-[#EDEAFB]"
        }`}
        title="Mở luồng hoàn tất và xuất tài liệu"
      >
        <span>★</span>
        <span>Export & Handoff</span>
      </button>

      {/* Progress & Verification Right Section */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {onVerificationClick && (
          <button
            onClick={onVerificationClick}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              verificationOpen
                ? "bg-[#FBF4E4] border border-[#F0DFB4] text-[#8A6D1F]"
                : "bg-white border border-[#ECEAE5] text-[#6B6862] hover:bg-[#FAF9F7]"
            }`}
            title="Đánh giá chất lượng & độ sẵn sàng"
          >
            <span>{verificationFlagsCount > 0 ? "⚠" : "✓"}</span>
            <span>
              Verification
              {verificationFlagsCount > 0 && ` (${verificationFlagsCount})`}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-[#6B6862]">
            SRS {progressPercent}%
          </span>
          <div className="w-24 h-1.5 rounded-full bg-[#F0EEEA] overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                background: "linear-gradient(90deg, #7C74F0, #4F46E5)",
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
