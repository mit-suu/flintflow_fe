"use client";

import type { ReactNode } from "react";
import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import { PHASES, PHASE_LABELS_VI, type PhaseId } from "@/lib/constants/step-registry";
import type { StepSummary } from "@/types/pipeline";

interface PhaseNavBarProps {
  currentPhase: string | null;
  steps: StepSummary[];
  /** Các giai đoạn đang mở danh sách bước (chế độ mở rộng) — mở nhiều cùng lúc được. */
  openPhases?: ReadonlySet<string>;
  onSelectPhase?: (phase: PhaseId) => void;
  /** Nội dung dưới giai đoạn đang mở (danh sách bước). */
  renderPhaseBody?: (phase: PhaseId) => ReactNode;
  /** Mode 1 v2: giai đoạn có bước "Thiếu" mang nhãn đỏ "Thiếu". */
  missingStepIds?: ReadonlySet<string>;
}

export type PhaseState = "completed" | "active" | "upcoming";

/** Phase xong khi mọi step của nó accepted; phase đang chạy là `current_phase`. */
export const phaseState = (phase: PhaseId, currentPhase: string | null, steps: StepSummary[]): PhaseState => {
  const phaseSteps = steps.filter((s) => s.phase === phase);
  if (phaseSteps.length > 0 && phaseSteps.every((s) => s.status === "accepted")) return "completed";
  if (phase === currentPhase) return "active";
  return "upcoming";
};

/** Phase hiển thị: bỏ phase không có step trong danh sách BE (mode 1 — FLF-185); danh sách rỗng ⇒ đủ 12. */
export const visiblePhases = (steps: StepSummary[]): PhaseId[] =>
  PHASES.filter((phase) => steps.length === 0 || steps.some((s) => s.phase === phase));

/** Mã hiển thị gọn: "B-0" → "B0" (chỉ để đọc; id giai đoạn vẫn giữ gạch nối như registry). */
export const shortPhase = (phase: string) => phase.replace("-", "");

/**
 * Hai nhóm giai đoạn theo màu logo: B (Brief) đen như chữ "Flint", S (Software Requirements Specification) tím như
 * chữ "Flow" — cho tiêu đề nhóm, chữ "đã xong" (`doneTextOf`) và ô "đang làm" (`activeCellOf`). Dòng giai đoạn chỉ ghi số.
 */
export const PHASE_GROUPS = [
  { letter: "B", name: "Brief", text: "text-on-surface" },
  { letter: "S", name: "Software Requirements Specification", text: "text-primary" },
] as const;

/** Màu chữ "đã xong" theo nhóm — dùng chung cho dòng giai đoạn và bước con. */
export const doneTextOf = (phase: string) => (phase.startsWith("B") ? "text-on-surface" : "text-primary-hover");
/** Mục "đang làm" tô đặc màu nhóm, chữ trắng: B nền đen (chữ "Flint"), S nền tím (chữ "Flow"). */
export const activeCellOf = (phase: string) =>
  phase.startsWith("B") ? "bg-on-surface text-surface-container-lowest font-semibold" : "bg-primary text-on-primary font-semibold";

/**
 * Kiểu sidebar shadcn: chỉ giai đoạn đang làm có nền (theo nhóm); đã xong là chữ đậm theo màu nhóm, chưa tới chữ xám
 * — không dấu tích, không khối màu. Cố ý không dùng vòng tròn/chấm: nhiều hình nhỏ xếp cột gây cảm giác lỗ chỗ.
 */
const rowClass = (phase: string, state: PhaseState) =>
  state === "active"
    ? activeCellOf(phase)
    : state === "completed"
      ? `${doneTextOf(phase)} font-semibold hover:bg-surface-container`
      : "text-on-surface-muted font-medium hover:bg-surface-container";

/**
 * 12 giai đoạn B-0…S-9 (Phases §1.1) xếp dọc trong rail tiến độ bên trái, gom theo nhóm B / S; mỗi giai đoạn là một
 * mục gập được độc lập (mở cái này không đóng cái khác).
 */
export default function PhaseNavBar({
  currentPhase,
  steps,
  openPhases,
  onSelectPhase,
  renderPhaseBody,
  missingStepIds,
}: PhaseNavBarProps) {
  const phases = visiblePhases(steps);
  return (
    <ol aria-label="Giai đoạn" className="flex flex-col gap-0.5">
      {PHASE_GROUPS.flatMap((group) => {
        const groupPhases = phases.filter((p) => p.startsWith(group.letter));
        if (groupPhases.length === 0) return [];
        const header = (
          <li key={group.letter} aria-hidden className="flex items-baseline gap-1.5 px-2.5 pt-2 pb-1 first:pt-0">
            <span className={`text-[12.5px] font-bold leading-snug ${group.text}`}>{group.name}</span>
          </li>
        );
        return [
          header,
          ...groupPhases.map((phase) => {
            const state = phaseState(phase, currentPhase, steps);
            const open = !!openPhases?.has(phase);
            const hasMissing = !!missingStepIds && steps.some((s) => s.phase === phase && s.status !== "accepted" && missingStepIds.has(s.id));
            const label = PHASE_LABELS_VI[phase];
            const code = shortPhase(phase);
            return (
              <li key={phase} aria-current={state === "active" ? "step" : undefined} data-state={state} className="ml-[18px]">
                <button
                  type="button"
                  onClick={() => onSelectPhase?.(phase)}
                  aria-expanded={open}
                  aria-label={`${code} · ${label}`}
                  className={`group relative w-full flex items-start rounded-control transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-9 py-2 px-2.5 gap-2.5 ${rowClass(phase, state)}`}
                >
                  <span className="w-4 shrink-0 text-left font-bold tabular-nums text-[12px] leading-[18px]">{phase.split("-")[1]}</span>
                  <span className="flex-1 min-w-0 text-left text-[13px] leading-snug break-words">{label}</span>
                  {hasMissing && <span className="mt-0.5 shrink-0 text-[9.5px] font-bold px-1.5 rounded-[4px] bg-error-container text-error">Thiếu</span>}
                  {/* Mũi tên chỉ hiện khi rê chuột hoặc đang mở — không lặp trên mọi dòng */}
                  <Icon
                    name="caret-right"
                    size={13}
                    className={`shrink-0 mt-[3px] transition-[transform,opacity] duration-200 ${open ? "rotate-90 opacity-60" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"}`}
                  />
                </button>
                {/* Bước con như sub-menu của shadcn: một đường dọc mảnh dưới số giai đoạn, danh sách thụt vào; mở/gập trượt mượt */}
                {renderPhaseBody && (
                  <Collapse open={open}>
                    <div className="ml-[17px] pl-2 my-1 border-l border-outline-variant">{renderPhaseBody(phase)}</div>
                  </Collapse>
                )}
              </li>
            );
          }),
        ];
      })}
    </ol>
  );
}
