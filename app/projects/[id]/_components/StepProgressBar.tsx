"use client";

import { PHASES, PHASE_LABELS_VI, stepLabel, type PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";

interface StepProgressBarProps {
  steps: StepSummary[];
  progress: StepProgress | null;
  /** Step đang chọn để xem/chạy. */
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  /** Mode 1 v2 (FLF-185): step của đầu mục mẫu FPT file không có — nhãn đỏ "Thiếu" tới khi chốt. */
  missingStepIds?: ReadonlySet<string>;
}

/** Số bước mỗi vòng S-5 (S-5.1 → S-5.5) — chỉ để giải thích trong tooltip. */
const STEPS_PER_LOOP = 5;

/** Khoá vòng của step mở rộng: `S-5.2@SCR-01` ⇒ `SCR-01`; step thường ⇒ null. */
const loopKeyOf = (stepId: string): string | null => {
  const at = stepId.indexOf("@");
  return at === -1 ? null : stepId.slice(at + 1);
};

/**
 * Tách step của một phase thành phần **hiện** và số vòng **đang ngủ**. Vòng ngủ = mọi bước còn `pending` và
 * không chứa bước hiện tại — đúng các màn `placeholder` mà `nextStep` của BE cũng bỏ qua.
 */
export const splitLoops = (phaseSteps: StepSummary[], current: string | null): { open: StepSummary[]; dormantLoops: number } => {
  const byLoop = new Map<string, StepSummary[]>();
  const plain: StepSummary[] = [];
  for (const step of phaseSteps) {
    const key = loopKeyOf(step.id);
    if (key === null) plain.push(step);
    else byLoop.set(key, [...(byLoop.get(key) ?? []), step]);
  }
  const open = [...plain];
  let dormantLoops = 0;
  for (const [, loopSteps] of byLoop) {
    const touched = loopSteps.some((s) => s.status !== "pending" || s.id === current);
    if (touched) open.push(...loopSteps);
    else dormantLoops++;
  }
  return { open, dormantLoops };
};

const DOT_STYLE: Record<StepSummary["status"], string> = {
  accepted: "bg-[#1F7A45] text-white",
  in_progress: "bg-[#6A62C4] text-white animate-pulse",
  revision_requested: "bg-[#C7811B] text-white",
  pending: "bg-[#F0EEEA] text-[#A8A49C]",
  skipped: "bg-transparent border border-dashed border-[#D8D4CC] text-[#C9C4BA]",
};

/**
 * Thanh tiến độ đếm **step** (Phases §1.1): "Bước done/total". % chỉ hiện sau khi S-4.1 chốt N.
 * Step đã accepted bấm để xem; step kế tiếp bấm để chạy; step chưa tới bị khoá.
 * Danh sách step là của BE (`GET /steps`) — project mode 1 chỉ có step áp dụng cho template, phase rỗng bị ẩn.
 */
export default function StepProgressBar({ steps, progress, selectedStepId, onSelectStep, missingStepIds }: StepProgressBarProps) {
  const current = progress?.current_step ?? null;
  const isMissing = (step: StepSummary) => !!missingStepIds?.has(step.id) && step.status !== "accepted";
  const missingCount = steps.filter(isMissing).length;
  const percent = progress && progress.total > 0 ? Math.round((progress.done * 100) / progress.total) : 0;

  return (
    <div className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center gap-4 shrink-0 overflow-x-auto" aria-label="Tiến độ theo bước">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-extrabold text-[#8A867E] tracking-wider uppercase">Bước</span>
        <span className="text-[12px] font-bold text-[#191817]" data-testid="step-count">
          {progress ? `${progress.done}/${progress.total}` : "—"}
        </span>
        {progress?.show_percent && (
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
      </div>

      <div className="flex items-center gap-3">
        {PHASES.map((phase: PhaseId) => {
          const all = steps.filter((s) => s.phase === phase);
          if (all.length === 0) return null;
          // Vòng S-5 mở rộng theo từng màn: tài liệu import ra 61 màn "để lại" ⇒ 300+ chấm không ai chạy.
          // Chỉ vẽ chấm cho vòng đã động tới (có bước chạy/chốt, hoặc đang là bước hiện tại); phần còn lại gom
          // thành một chip cho thấy "ở đó có step" — mở ra khi màn có function (người dùng thêm feature/function).
          const { open, dormantLoops } = splitLoops(all, current);
          const phaseSteps = open;
          return (
            <div key={phase} className="flex items-center gap-1 shrink-0" title={PHASE_LABELS_VI[phase]}>
              <span className="text-[10px] font-bold text-[#8A867E] mr-0.5">{phase}</span>
              {dormantLoops > 0 && (
                <span
                  data-testid="dormant-loops"
                  title={`${dormantLoops} màn đang để lại (placeholder) — mỗi màn có ${STEPS_PER_LOOP} bước S-5, chỉ mở khi màn có function. Thêm feature/function cho màn để chạy các bước này.`}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F0EEEA] text-[#8A867E] border border-[#E4E1DC] shrink-0"
                >
                  +{dormantLoops} màn để lại
                </span>
              )}
              {phaseSteps.map((step) => {
                const isCurrent = step.id === current;
                const clickable = step.status === "accepted" || isCurrent || step.status === "revision_requested";
                const missing = isMissing(step);
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectStep(step.id)}
                    aria-label={`${step.id} ${stepLabel(step.id)}${missing ? " (Thiếu)" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    data-missing={missing || undefined}
                    title={`${step.id} · ${stepLabel(step.id)}${missing ? " — Thiếu: đầu mục FPT file không có" : ""}`}
                    className={`h-2.5 rounded-full transition-all ${isCurrent ? "w-5" : "w-2.5"} ${missing ? "bg-[#B03030] text-white" : DOT_STYLE[step.status]} ${
                      selectedStepId === step.id ? "ring-2 ring-[#6A62C4] ring-offset-1" : ""
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
