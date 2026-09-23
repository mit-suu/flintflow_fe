"use client";

import { getStepDef, PHASES, type PhaseId } from "@/lib/constants/step-registry";
import type { StepSummary } from "@/types/pipeline";

/**
 * Lớp 1 "Bản đồ hành trình" (`03-live-status-flow.md`): luôn hiện ở đầu trang và trả lời một câu hỏi duy
 * nhất — *tôi đang ở đâu, còn bao xa*.
 *
 * Hai con số ở đây phải là số thật: phần trăm tài liệu do BE tính (`readiness.accepted_pct`), và "còn N
 * điểm duyệt" đếm **cổng chốt còn lại theo chế độ duyệt**, không phải 91 bước. Lượt test cho thấy user
 * không biết mình đang ở đâu trong 91 bước — một thanh trạng thái không nói được điều đó thì vô dụng.
 */

interface JourneyBarProps {
  steps: StepSummary[];
  currentStepId: string | null;
  /** % tài liệu đã chốt, do BE tính. */
  readinessPercent?: number;
  /** Số dư credit của user (nếu có) — cùng một dòng "tôi đang tiêu gì". */
  credits?: number | null;
  /** Chế độ duyệt hiện tại — quyết định cách đếm điểm duyệt còn lại. */
  reviewMode?: "strict" | "balanced" | "fast";
}

/** Bước luôn cần người duyệt, dù chế độ nào (đồng bộ với `quiet-step.ts` phía BE). */
const ALWAYS_GATE = new Set(["B-0.1", "S-4.1", "S-9.4", "S-9.5"]);

const templateOf = (stepId: string): string => stepId.split("@")[0];

/** Đơn vị giai đoạn: phase thường; vòng S-5 tính theo từng màn (mỗi màn một cổng chốt). */
export const unitOf = (stepId: string, phase: string): string => (stepId.includes("@") ? `${phase}@${stepId.split("@")[1]}` : phase);

/**
 * Số cổng chốt user còn phải bấm. Chế độ Chặt: mỗi bước chưa accepted là một điểm dừng. Cân bằng/Nhanh:
 * mỗi đơn vị giai đoạn còn dở là một điểm dừng, cộng các bước luôn cần người.
 */
export const remainingGates = (steps: StepSummary[], reviewMode: JourneyBarProps["reviewMode"] = "balanced"): number => {
  const pending = steps.filter((s) => s.status !== "accepted");
  if (reviewMode === "strict") return pending.length;

  // Mỗi đơn vị giai đoạn còn dở có một cổng chốt, đặt ở bước cuối của đơn vị đó
  const terminalOfUnit = new Map<string, string>();
  for (const step of pending) terminalOfUnit.set(unitOf(step.id, step.phase), step.id);

  // Cộng thêm các bước luôn cần người quyết, trừ khi chính nó đã là cổng chốt cuối đơn vị
  const alwaysGate = pending.filter((s) => ALWAYS_GATE.has(templateOf(s.id)) && terminalOfUnit.get(unitOf(s.id, s.phase)) !== s.id);
  return terminalOfUnit.size + alwaysGate.length;
};

interface PhaseState {
  phase: PhaseId;
  done: boolean;
  current: boolean;
  /** Vòng S-5: đang ở màn thứ mấy trên tổng. */
  loop?: { index: number; total: number };
}

export const phaseStates = (steps: StepSummary[], currentStepId: string | null): PhaseState[] => {
  const current = steps.find((s) => s.id === currentStepId);
  return PHASES.filter((phase) => steps.some((s) => s.phase === phase)).map((phase) => {
    const inPhase = steps.filter((s) => s.phase === phase);
    const state: PhaseState = {
      phase,
      done: inPhase.length > 0 && inPhase.every((s) => s.status === "accepted"),
      current: current?.phase === phase,
    };
    if (phase === "S-5" && current?.phase === "S-5" && currentStepId?.includes("@")) {
      const loops = [...new Set(inPhase.map((s) => s.id.split("@")[1]))];
      const index = loops.indexOf(currentStepId.split("@")[1]);
      if (index >= 0) state.loop = { index: index + 1, total: loops.length };
    }
    return state;
  });
};

export default function JourneyBar({ steps, currentStepId, readinessPercent, credits, reviewMode = "balanced" }: JourneyBarProps) {
  if (steps.length === 0) return null;
  const phases = phaseStates(steps, currentStepId);
  const current = steps.find((s) => s.id === currentStepId);
  const gates = remainingGates(steps, reviewMode);
  const loop = phases.find((p) => p.current)?.loop;

  return (
    <section aria-label="Bản đồ hành trình" className="px-4 py-2 bg-surface-container-lowest border-b border-outline-variant flex flex-col gap-1.5">
      {/* Dãy tên giai đoạn đã bỏ khỏi header — rail tiến độ bên trái đã nói đủ; ở đây chỉ còn số liệu. */}
      <div className="flex items-center justify-end gap-3 text-[11.5px]">
        <div className="flex items-center gap-3 shrink-0 text-on-surface-muted">
          {readinessPercent !== undefined && <span>Tài liệu: {Math.round(readinessPercent)}%</span>}
          {typeof credits === "number" && <span>{credits} credit</span>}
        </div>
      </div>
      <p className="text-[11px] text-on-surface-muted">
        {current ? (
          <>
            Đang ở: <strong className="text-on-surface">{getStepDef(current.id)?.label_vi ?? current.label_vi}</strong>
            {loop ? ` · màn ${loop.index}/${loop.total}` : ""} · còn khoảng {gates} điểm duyệt
          </>
        ) : (
          <>Đã đi hết quy trình</>
        )}
      </p>
    </section>
  );
}
