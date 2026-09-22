"use client";

import { PHASES, PHASE_LABELS_VI, stepLabel, type PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";
import { activeCellOf, doneTextOf } from "./PhaseNavBar";

interface StepProgressBarProps {
  steps: StepSummary[];
  progress: StepProgress | null;
  /** Step đang chọn để xem/chạy. */
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  /** Mode 1 v2 (FLF-185): step của đầu mục mẫu FPT file không có — nhãn đỏ "Thiếu" tới khi chốt. */
  missingStepIds?: ReadonlySet<string>;
  /** Chỉ hiện bước của một phase; bỏ trống ⇒ mọi phase, gom theo nhóm. */
  phase?: string | null;
}

/**
 * Cùng quy ước với giai đoạn (kiểu shadcn): đã chốt chữ đậm, bước đang làm có nền — cả hai theo màu nhóm (B đen, S tím); chưa tới chữ xám —
 * không tô nền từng ô.
 */
const CELL: Record<StepSummary["status"], string> = {
  accepted: "hover:bg-surface-container",
  in_progress: "bg-primary-soft text-primary font-semibold",
  revision_requested: "text-accent-gold-text hover:bg-surface-container",
  pending: "text-on-surface-subtle",
  skipped: "text-on-surface-subtle line-through",
};

const STATUS_HINT: Record<StepSummary["status"], string> = {
  accepted: "đã chốt",
  in_progress: "đang làm",
  revision_requested: "cần duyệt lại",
  pending: "chưa tới",
  skipped: "bỏ qua",
};

/**
 * Bước của phase dạng danh sách dọc có tên (thay cho dãy chấm vô danh): đã chốt ✓, đang làm tím, chưa tới mờ và khoá.
 * Step đã accepted bấm để xem; step hiện tại / cần duyệt lại bấm để chạy. % chỉ hiện sau khi S-4.1 chốt N.
 * Danh sách step là của BE (`GET /steps`) — project mode 1 chỉ có step áp dụng cho template, phase rỗng bị ẩn.
 */
export default function StepProgressBar({ steps, progress, selectedStepId, onSelectStep, missingStepIds, phase = null }: StepProgressBarProps) {
  const current = progress?.current_step ?? null;
  const isMissing = (step: StepSummary) => !!missingStepIds?.has(step.id) && step.status !== "accepted";
  const missingCount = steps.filter(isMissing).length;
  const percent = progress && progress.total > 0 ? Math.round((progress.done * 100) / progress.total) : 0;
  const groups = (phase ? [phase] : PHASES).map((p) => ({ phase: p, items: steps.filter((s) => s.phase === p) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-2" aria-label="Tiến độ theo bước">
      {(progress?.show_percent || missingCount > 0) && (
        <div className="flex items-center gap-2">
          {progress?.show_percent && (
            <span className="text-[11.5px] font-bold text-primary tabular-nums" data-testid="step-percent">
              {percent}% hoàn thành
            </span>
          )}
          {missingCount > 0 && (
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-error-container text-error"
              data-testid="step-missing"
              title="Đầu mục mẫu FPT file upload không có — chạy step để AI soạn trước khi ký baseline v1"
            >
              Thiếu {missingCount}
            </span>
          )}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.phase} className="flex flex-col gap-1.5">
          {!phase && <span className="text-[11px] font-bold text-on-surface-muted">{PHASE_LABELS_VI[group.phase as PhaseId] ?? group.phase}</span>}
          <ol className="flex flex-col gap-0.5">
            {group.items.map((step) => {
              const isCurrent = step.id === current;
              const clickable = step.status === "accepted" || isCurrent || step.status === "revision_requested";
              const missing = isMissing(step);
              const cell = missing ? "text-error hover:bg-surface-container" : isCurrent ? activeCellOf(step.phase) : `${CELL[step.status]} ${step.status === "accepted" ? doneTextOf(step.phase) : ""}`;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectStep(step.id)}
                    aria-label={`${step.id} ${stepLabel(step.id)}${missing ? " (Thiếu)" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    data-missing={missing || undefined}
                    title={`${step.id} · ${stepLabel(step.id)} — ${missing ? "Thiếu: đầu mục FPT file không có" : isCurrent ? "đang làm" : STATUS_HINT[step.status]}`}
                    className={`w-full min-h-8 py-1.5 px-2.5 rounded-control text-[12.5px] flex items-center gap-2 text-left transition-colors duration-150 ${cell} ${
                      selectedStepId === step.id && !isCurrent ? "bg-surface-container-high" : ""
                    } ${clickable ? "cursor-pointer" : "cursor-not-allowed"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  >
                    <span className="flex-1 min-w-0 leading-snug break-words">{stepLabel(step.id)}</span>
                    {missing && <span className="text-[10px] font-bold">Thiếu</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
