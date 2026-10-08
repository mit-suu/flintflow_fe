"use client";

import { PHASES, type PhaseId } from "@/lib/constants/step-registry";
import type { StepProgress, StepSummary } from "@/types/pipeline";
import { RAIL_ROW_VIEWED, STEP_ACTIVE_CELL } from "./PhaseNavBar";
import { PHASE_NAV_LABELS, workspaceStepLabel as stepLabel } from "./phase-labels";

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
 * Bước con chỉ đổi CHỮ theo trạng thái; nền để dành cho đúng một dòng — bước đang làm (`STEP_ACTIVE_CELL`).
 * Cùng quy ước màu với dòng giai đoạn: tím = đã chốt hoặc đang làm, xám = chưa tới. "Chưa tới" dùng
 * `on-surface-variant` (≈5:1) chứ không phải `on-surface-subtle` (≈3:1, trông như bị khoá):
 * bước chưa chạy vẫn là thứ người dùng cần đọc để biết phía trước có gì.
 */
const CELL: Record<StepSummary["status"], string> = {
  accepted: "text-primary-hover font-medium",
  in_progress: STEP_ACTIVE_CELL,
  revision_requested: "text-accent-gold-text font-medium",
  pending: "text-on-surface-variant",
  skipped: "text-on-surface-muted line-through",
};

/** Tâm chấm cách mép trên dòng 17px — đúng tâm dòng chữ đầu tiên (4px đệm dòng + 4px đệm ô chữ + nửa dòng 18px). */
const DOT_CENTER = 17;

/** Nửa đường kẻ trên và dưới chấm. Dòng đầu không có nửa trên, dòng cuối không có nửa dưới. */
const Connector = ({ above, below }: { above: boolean; below: boolean }) => (
  <>
    {above && <span aria-hidden className="absolute left-[5.5px] top-0 w-px bg-outline-variant" style={{ height: DOT_CENTER }} />}
    {below && <span aria-hidden className="absolute left-[5.5px] bottom-0 w-px bg-outline-variant" style={{ top: DOT_CENTER }} />}
  </>
);

/** Chấm mốc: bước đang làm to hơn và tô tím; còn lại xám trung tính — trạng thái đã nằm ở màu chữ, chấm không lặp lại. */
const DOT_TONE = {
  current: "size-2.5 bg-primary-hover",
  revision: "size-2 bg-accent-gold",
  missing: "size-2 bg-error",
  plain: "size-2 bg-surface-container-highest",
} as const;

const Dot = ({ tone }: { tone: keyof typeof DOT_TONE }) => (
  // `relative` để chấm nằm ĐÈ lên đường kẻ (đường kẻ là absolute nên mặc định vẽ chồng lên nội dung thường)
  <span aria-hidden className="relative mt-1 h-[18px] w-3 shrink-0 grid place-items-center">
    <span className={`rounded-full ${DOT_TONE[tone]}`} />
  </span>
);

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
            <span className="text-body font-bold text-primary-hover tabular-nums" data-testid="step-percent">
              {percent}% hoàn thành
            </span>
          )}
          {missingCount > 0 && (
            <span
              className="text-caption font-bold px-2 py-0.5 rounded-full bg-error-container text-error"
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
          {!phase && <span className="text-caption font-bold text-on-surface-muted">{PHASE_NAV_LABELS[group.phase as PhaseId] ?? group.phase}</span>}
          <ol className="flex flex-col">
            {open.map((step, index) => {
              const isCurrent = step.id === current;
              // Dòng kẻ vẽ theo TỪNG dòng (nửa trên + nửa dưới quanh chấm) chứ không phải một vạch chạy suốt danh
              // sách: nhãn dài xuống hai dòng làm chiều cao mỗi dòng mỗi khác, một vạch tuyệt đối sẽ thò ra ngoài
              // chấm đầu và chấm cuối.
              const first = index === 0;
              const last = index === open.length - 1 && dormantLoops === 0;
              // BUG-03: vòng S-5 của màn bị để trống nằm ngoài "tới lượt", nhưng user phải mở lại được —
              // trước đây panel khoá cứng 5 bước của màn đó và không còn đường nào quay lại.
              const reopenable = reopenableStepIds?.has(step.id) ?? false;
              const clickable = step.status === "accepted" || isCurrent || step.status === "revision_requested" || reopenable;
              const missing = isMissing(step);
              const cell = missing ? "text-error font-medium" : isCurrent ? STEP_ACTIVE_CELL : CELL[step.status];
              return (
                <li key={step.id} className="relative">
                  <Connector above={!first} below={!last} />
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectStep(step.id)}
                    aria-label={`${stepLabel(step.id)}${missing ? " (Thiếu)" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    data-missing={missing || undefined}
                    title={`${step.id} · ${stepLabel(step.id)} — ${
                      missing ? "Thiếu: đầu mục FPT file không có" : isCurrent ? "đang làm" : reopenable ? "màn đang để trống — bấm để mở lại" : STATUS_HINT[step.status]
                    }`}
                    className={`group w-full py-1 flex items-start gap-2 text-left ${
                      clickable ? "cursor-pointer" : "cursor-not-allowed"
                    } focus-visible:outline-none`}
                  >
                    <Dot tone={missing ? "missing" : isCurrent ? "current" : step.status === "revision_requested" ? "revision" : "plain"} />
                    {/* Nền chỉ ôm lấy chữ chứ không trải hết bề ngang: cột chấm phải đứng ngoài ô màu thì mốc thời
                        gian mới đọc được. Vùng bấm vẫn là cả dòng. */}
                    <span
                      className={`flex-1 min-w-0 rounded-inner px-2 py-1 text-body leading-snug break-words transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-primary ${cell} ${
                        selectedStepId === step.id && !isCurrent ? RAIL_ROW_VIEWED : ""
                      } ${isCurrent ? "" : "group-hover:bg-surface-container"}`}
                    >
                      {stepLabel(step.id)}
                      {missing && <span className="ml-2 text-caption font-bold">Thiếu</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {dormantLoops > 0 && (
              <li
                data-testid="dormant-loops"
                title={`${dormantLoops} màn đang để lại (placeholder) — mỗi màn có ${STEPS_PER_LOOP} bước S-5, chỉ mở khi màn có function. Thêm feature/function cho màn để chạy các bước này.`}
                className="relative py-1 flex items-start gap-2"
              >
                <Connector above below={false} />
                <Dot tone="plain" />
                <span className="flex-1 min-w-0 px-2 py-1 text-body text-on-surface-variant italic">+{dormantLoops} màn để lại</span>
              </li>
            )}
          </ol>
        </div>
        );
      })}
    </div>
  );
}
