"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import IconButton from "@/components/ui/IconButton";
import type { PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";
import PhaseNavBar, { visiblePhases } from "./PhaseNavBar";
import { SINGLE_ITEM_PHASES } from "./phase-labels";
import StepProgressBar from "./StepProgressBar";

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
}

/**
 * Rail tiến độ bên trái: chỉ có MỞ hoặc ẨN HẲN (không có dạng cột thu nhỏ — bước đang làm đã hiện ở đầu khung chat).
 * Giai đoạn gom theo nhóm B / S, mỗi giai đoạn gập/mở độc lập; giai đoạn đang làm mở sẵn. Đáy rail là % tài liệu đã
 * chốt kèm thanh tiến độ (cách AI làm việc đã chuyển về ô chat).
 *
 * Nền rail giữ trắng như pane chat: cột đã tách bằng khoảng trắng, không cần đổi nền. Lề trái của mọi bậc chữ đều
 * về 20px (logo, nhãn cột, tiêu đề nhóm, tên giai đoạn, nhãn ở đáy) để cột có một đường gióng duy nhất.
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
}: WorkspaceProgressRailProps) {
  // Giai đoạn đang mở danh sách bước (nhiều cái cùng lúc). `null` = chưa đụng tới ⇒ mở sẵn giai đoạn đang làm.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const openPhases: ReadonlySet<string> = picked ?? new Set(currentPhase ? [currentPhase] : []);
  // Mục đơn (Ý tưởng) không có danh sách bước con ⇒ không tính vào "mở/thu gọn tất cả"
  const allPhases = visiblePhases(steps).filter((phase) => !SINGLE_ITEM_PHASES.has(phase));

  /** Mục đơn bấm là xem thẳng bước đang làm của giai đoạn đó (hoặc bước cuối nếu đã xong hết). */
  const openSinglePhase = (phase: PhaseId) => {
    const inPhase = steps.filter((s) => s.phase === phase);
    const target = inPhase.find((s) => s.id === progress?.current_step) ?? inPhase.find((s) => s.status !== "accepted") ?? inPhase.at(-1);
    if (target) onSelectStep(target.id);
  };

  const togglePhase = (phase: PhaseId) => {
    if (SINGLE_ITEM_PHASES.has(phase)) {
      openSinglePhase(phase);
      return;
    }
    const next = new Set(openPhases);
    if (next.has(phase)) next.delete(phase);
    else next.add(phase);
    setPicked(next);
  };

  return (
    <nav id="workspace-progress" aria-label="Tiến độ" className="w-full h-full bg-surface-container-lowest flex flex-col">
      <div className="h-[58px] shrink-0 pl-5 pr-3 flex items-center justify-between">
        <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" href="/home" />
        <IconButton icon="sidebar" size="sm" label="Ẩn tiến độ" onClick={onHide} />
      </div>

      {/* Nhãn cột: chữ hoa nhỏ, giãn chữ — cố ý khác hẳn tiêu đề nhóm (15px bold) để không thành thêm một bậc nữa */}
      <div className="pl-5 pr-3 pb-1 flex items-center justify-between">
        <span className="text-caption font-bold uppercase tracking-[0.06em] text-on-surface-muted">Tiến độ</span>
        {/* Một nút bật/tắt như "Collapse All" của VS Code: đang mở giai đoạn nào ⇒ gập hết; gập hết rồi ⇒ mở hết */}
        <IconButton
          icon="caret-up-down"
          size="sm"
          label={openPhases.size > 0 ? "Thu gọn tất cả bước" : "Mở rộng tất cả bước"}
          onClick={() => setPicked(openPhases.size > 0 ? new Set() : new Set(allPhases))}
        />
      </div>

      <div className="ff-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-1">
        <PhaseNavBar
          currentPhase={currentPhase}
          steps={steps}
          openPhases={openPhases}
          onSelectPhase={togglePhase}
          currentStepId={progress?.current_step ?? null}
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

      {/* Đáy rail: số phần trăm cộng một thanh mảnh màu thương hiệu — rãnh lavender, phần đã chốt tím đặc */}
      <div className="ff-fade-above [--ff-fade:var(--color-surface-container-lowest)] shrink-0 bg-surface-container-lowest px-5 pt-3 pb-4">
        {readinessPercent !== undefined && (
          <div className="flex flex-col gap-2" title="Phần mục bắt buộc của SRS đã được bạn duyệt xong">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-body font-medium text-on-surface-variant">Tài liệu đã chốt</span>
              <span className="text-body font-bold text-on-surface-dark tabular-nums">{readinessPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={readinessPercent}
              className="h-1.5 rounded-full bg-primary-fixed overflow-hidden"
            >
              <span aria-hidden className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${readinessPercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
