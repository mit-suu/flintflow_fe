"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import IconButton from "@/components/ui/IconButton";
import type { PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";
import type { WorkingMode } from "@/types/spine";
import PhaseNavBar, { visiblePhases } from "./PhaseNavBar";
import StepProgressBar from "./StepProgressBar";
import WorkingModeSelect from "./WorkingModeSelect";

interface WorkspaceProgressRailProps {
  /** Ẩn rail (nút ở đầu rail); mở lại bằng nút ở header. */
  onHide: () => void;
  currentPhase: string | null;
  steps: StepSummary[];
  progress: StepProgress | null;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  missingStepIds?: ReadonlySet<string>;
  /** Bước của vòng S-5 thuộc màn đang để trống — mở lại được (BUG-03). */
  reopenableStepIds?: ReadonlySet<string>;
  /** Điểm sẵn sàng (% section accepted) — hiển thị, không phải điều kiện chốt. */
  readinessPercent?: number;
  workingMode: WorkingMode | null;
  onChangeWorkingMode: (mode: WorkingMode) => void;
  busy?: boolean;
}

/**
 * Rail tiến độ bên trái kiểu sidebar shadcn: chỉ có MỞ hoặc ẨN HẲN (không có dạng cột thu nhỏ — bước đang làm đã hiện
 * ở đầu khung chat). Giai đoạn gom theo nhóm B / S, mỗi giai đoạn gập/mở độc lập; giai đoạn đang làm mở sẵn. Đáy rail
 * là điểm sẵn sàng và cách làm việc (B-0.4).
 */
export default function WorkspaceProgressRail({
  onHide,
  currentPhase,
  steps,
  progress,
  selectedStepId,
  onSelectStep,
  missingStepIds,
  reopenableStepIds,
  readinessPercent,
  workingMode,
  onChangeWorkingMode,
  busy = false,
}: WorkspaceProgressRailProps) {
  // Giai đoạn đang mở danh sách bước (nhiều cái cùng lúc). `null` = chưa đụng tới ⇒ mở sẵn giai đoạn đang làm.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const openPhases: ReadonlySet<string> = picked ?? new Set(currentPhase ? [currentPhase] : []);
  const allPhases = visiblePhases(steps);

  const togglePhase = (phase: PhaseId) => {
    const next = new Set(openPhases);
    if (next.has(phase)) next.delete(phase);
    else next.add(phase);
    setPicked(next);
  };

  return (
    <nav id="workspace-progress" aria-label="Tiến độ" className="w-[264px] h-full shrink-0 bg-surface-container-lowest flex flex-col">
      <div className="h-[58px] shrink-0 pl-5 pr-3 flex items-center justify-between">
        <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" href="/home" />
        <IconButton icon="sidebar" size="sm" label="Ẩn tiến độ" onClick={onHide} />
      </div>

      <div className="pl-5 pr-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-on-surface-muted">Tiến độ</span>
        {/* Một nút bật/tắt như "Collapse All" của VS Code: đang mở giai đoạn nào ⇒ gập hết; gập hết rồi ⇒ mở hết */}
        <IconButton
          icon="caret-up-down"
          size="sm"
          label={openPhases.size > 0 ? "Thu gọn tất cả bước" : "Mở rộng tất cả bước"}
          onClick={() => setPicked(openPhases.size > 0 ? new Set() : new Set(allPhases))}
        />
      </div>

      <div className="ff-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-1">
        <PhaseNavBar
          currentPhase={currentPhase}
          steps={steps}
          openPhases={openPhases}
          onSelectPhase={togglePhase}
          missingStepIds={missingStepIds}
          renderPhaseBody={(phase) => (
            <StepProgressBar
              phase={phase}
              steps={steps}
              progress={progress}
              selectedStepId={selectedStepId}
              onSelectStep={onSelectStep}
              missingStepIds={missingStepIds}
              reopenableStepIds={reopenableStepIds}
            />
          )}
        />
      </div>

      <div className="ff-fade-above [--ff-fade:var(--color-surface-container-lowest)] shrink-0 bg-surface-container-lowest px-4 py-3 flex flex-col gap-2.5">
        {readinessPercent !== undefined && (
          <div className="flex items-center justify-between text-[12px]" title="Điểm sẵn sàng: % section bắt buộc đã accepted">
            <span className="text-on-surface-muted font-medium">Sẵn sàng</span>
            <span className="font-bold text-on-surface tabular-nums">{readinessPercent}% accepted</span>
          </div>
        )}
        <WorkingModeSelect value={workingMode} onChange={onChangeWorkingMode} disabled={busy} />
      </div>
    </nav>
  );
}
