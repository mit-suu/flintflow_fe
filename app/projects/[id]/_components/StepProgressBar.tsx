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
  /**
   * Bước mở lại được dù chưa tới lượt — vòng S-5 của màn đang để trống (BUG-03). Không có nó thì màn bị
   * bỏ qua là bỏ qua vĩnh viễn: panel khoá cứng cả năm bước và tài liệu chỉ còn cái tiêu đề.
   */
  reopenableStepIds?: ReadonlySet<string>;
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
export default function StepProgressBar({
  steps,
  progress,
  selectedStepId,
  onSelectStep,
  missingStepIds,
  phase = null,
  reopenableStepIds,
}: StepProgressBarProps) {
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

      {groups.map((group) => {
        // Vòng S-5 mở rộng theo từng màn: tài liệu import ra 61 màn "để lại" ⇒ 300+ dòng không ai chạy.
        // Chỉ liệt kê vòng đã động tới (có bước chạy/chốt, hoặc đang là bước hiện tại); phần còn lại gom
        // thành một dòng cho thấy "ở đó có step" — mở ra khi màn có function (người dùng thêm feature/function).
        const { open, dormantLoops } = splitLoops(group.items, current);
        return (
        <div key={group.phase} className="flex flex-col gap-1.5">
          {!phase && <span className="text-[11px] font-bold text-on-surface-muted">{PHASE_LABELS_VI[group.phase as PhaseId] ?? group.phase}</span>}
          <ol className="flex flex-col gap-0.5">
            {open.map((step) => {
              const isCurrent = step.id === current;
              // BUG-03: vòng S-5 của màn bị để trống nằm ngoài "tới lượt", nhưng user phải mở lại được —
              // trước đây panel khoá cứng 5 bước của màn đó và không còn đường nào quay lại.
              const reopenable = reopenableStepIds?.has(step.id) ?? false;
              const clickable = step.status === "accepted" || isCurrent || step.status === "revision_requested" || reopenable;
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
                    title={`${step.id} · ${stepLabel(step.id)} — ${
                      missing ? "Thiếu: đầu mục FPT file không có" : isCurrent ? "đang làm" : reopenable ? "màn đang để trống — bấm để mở lại" : STATUS_HINT[step.status]
                    }`}
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
            {dormantLoops > 0 && (
              <li
                data-testid="dormant-loops"
                title={`${dormantLoops} màn đang để lại (placeholder) — mỗi màn có ${STEPS_PER_LOOP} bước S-5, chỉ mở khi màn có function. Thêm feature/function cho màn để chạy các bước này.`}
                className="min-h-8 py-1.5 px-2.5 text-[12px] text-on-surface-subtle italic"
              >
                +{dormantLoops} màn để lại
              </li>
            )}
          </ol>
        </div>
        );
      })}
    </div>
  );
}
