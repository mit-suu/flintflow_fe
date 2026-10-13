"use client";

import type { ReactNode } from "react";
import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import { PHASES, type PhaseId } from "@/lib/constants/step-registry";
import type { StepSummary } from "@/types/pipeline";
import { PHASE_NAV_LABELS, SINGLE_ITEM_PHASES, workspaceStepLabel } from "./phase-labels";

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
  /** Bước đang làm — ghi tên ngay dưới giai đoạn khi giai đoạn đó đang gập (xem `rowClass`). */
  currentStepId?: string | null;
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

/**
 * Hai nhóm giai đoạn: B (Brief) và S (Software Requirements Specification). Tên nhóm dùng CÙNG một màu chữ —
 * trước đây B đen / S tím, nhưng rải màu ra nhiều chỗ như vậy thì người đọc không biết màu đang nói điều gì.
 * Tên nhóm mang màu thương hiệu — cùng hệ với chữ tím của các bước đã đi qua bên dưới.
 *
 * Icon CHỈ có ở hai dòng này — hai thứ cố định tuyệt đối của rail, mọi chế độ tài liệu đều có. Mười hai dòng giai
 * đoạn bên dưới cố ý để trần: một cột icon chạy suốt chiều cao rail làm cột nặng và kéo mắt khỏi thứ duy nhất cần
 * nhìn là ô lavender.
 */
export const PHASE_GROUPS = [
  { letter: "B", name: "Tóm tắt ý tưởng", icon: "sparkle" },
  { letter: "S", name: "Tài liệu SRS", icon: "file" },
] as const;

/**
 * Ô "bước đang làm" — khối nền DUY NHẤT của rail: lavender + chữ tím đậm, đúng quy ước mục đang chọn của sidebar
 * dashboard (`SIDEBAR_ROW_ACTIVE`). Giai đoạn cha đang làm chỉ đổi chữ chứ không tô nền, nên không còn hai khối
 * đậm lồng nhau như bản cũ (nhóm B tô nền đen cho cả giai đoạn và bước bên trong).
 */
export const PHASE_ACTIVE_CELL = "bg-primary-fixed text-primary-hover font-semibold";

/** Bước đang làm: cùng ô lavender nhưng nhạt hơn một nấc (`primary-soft`) để nằm lồng trong ô của giai đoạn cha
 *  mà vẫn phân biệt được bậc — hai ô cùng sắc tím, không phải hai khối đặc chọi nhau. */
export const STEP_ACTIVE_CELL = "bg-primary-soft text-primary-hover font-semibold";

/** Dòng chưa active: nền hover xám ấm rất nhạt trên cột rail trắng. */
export const RAIL_ROW_HOVER = "hover:bg-surface-container";

/** Bước đang XEM mà không phải bước đang làm: xám trung tính — thấy rõ nhưng không tranh với ô lavender. */
export const RAIL_ROW_VIEWED = "bg-surface-container-high";

/**
 * Màu chữ mang đúng MỘT nghĩa, đọc một lần là nhớ: **tím = đã đi qua hoặc đang ở đây, xám = chưa tới**.
 * - đang làm → ô lavender `primary-fixed` + chữ tím đậm (bước con đang làm dùng lavender nhạt hơn, lồng bên trong)
 * - đã xong  → chữ tím, nhạt nét hơn
 * - chưa tới → `on-surface-variant` (#6b6862 ≈ 5:1) — xám đọc được, không mờ như bị khoá
 * Giai đoạn đang mở chỉ dày nét thêm một nấc, không đổi màu: mở/gập là chuyện hiển thị, không phải trạng thái việc.
 */
const rowClass = (state: PhaseState, open: boolean) => {
  if (state === "active") return PHASE_ACTIVE_CELL;
  if (state === "completed") return `text-primary-hover ${open ? "font-semibold" : "font-medium"}`;
  return `text-on-surface-variant ${open ? "font-medium" : "font-normal"}`;
};

/**
 * 12 giai đoạn (Phases §1.1) xếp dọc trong rail tiến độ bên trái, gom theo nhóm B / S, gọi bằng tên đời thường — mã
 * B-x / S-x chỉ nằm trong tooltip. Mỗi giai đoạn là một mục gập được độc lập; riêng giai đoạn đầu (Ý tưởng) là một mục
 * đơn, không có bước con.
 *
 * Ba bậc, mỗi bậc thụt thêm 16px nên nhìn là biết ai thuộc ai — chữ lần lượt bắt đầu ở 20 / 34 / 50px:
 * tiêu đề NHÓM (icon + 15px semibold) → GIAI ĐOẠN (13px) → BƯỚC (13px). Bậc khác nhau nhờ cỡ chữ, độ đậm và
 * vị trí — không thêm khối nền, không thêm màu, không kẻ đường dẫn.
 */
export default function PhaseNavBar({
  currentPhase,
  steps,
  openPhases,
  onSelectPhase,
  renderPhaseBody,
  missingStepIds,
  currentStepId,
}: PhaseNavBarProps) {
  const phases = visiblePhases(steps);
  return (
    <ol aria-label="Giai đoạn" className="flex flex-col gap-0.5">
      {PHASE_GROUPS.flatMap((group) => {
        const groupPhases = phases.filter((p) => p.startsWith(group.letter));
        if (groupPhases.length === 0) return [];
        const header = (
          <li key={group.letter} aria-hidden className="px-2.5 pt-5 pb-1.5 first:pt-1 flex items-center gap-2 text-primary-hover">
            <Icon name={group.icon} size={16} />
            <span className="text-heading font-semibold">{group.name}</span>
          </li>
        );
        return [
          header,
          ...groupPhases.map((phase) => {
            const state = phaseState(phase, currentPhase, steps);
            const open = !!openPhases?.has(phase);
            const hasMissing = !!missingStepIds && steps.some((s) => s.phase === phase && s.status !== "accepted" && missingStepIds.has(s.id));
            const label = PHASE_NAV_LABELS[phase];
            const single = SINGLE_ITEM_PHASES.has(phase);
            const active = state === "active";
            // Gập giai đoạn đang làm thì danh sách bước biến mất ⇒ ghi tên bước đang làm ngay dưới tên giai đoạn,
            // để vẫn trả lời được câu "tôi đang ở đâu" mà không phải xổ cả danh sách ra.
            const currentStepLabel = active && !open && !single && currentStepId ? workspaceStepLabel(currentStepId) : null;
            return (
              <li key={phase} aria-current={state === "active" ? "step" : undefined} data-state={state} className="ml-4">
                <button
                  type="button"
                  onClick={() => onSelectPhase?.(phase)}
                  aria-expanded={single ? undefined : open}
                  title={`Giai đoạn ${phase}`}
                  // Dòng đã có ô lavender thì bỏ nền hover: hover xám sẽ đè mất chính ô đang chỉ chỗ
                  className={`w-full flex items-start rounded-control transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-9 py-2 px-2 gap-2 ${active ? "" : RAIL_ROW_HOVER} ${rowClass(state, open)}`}
                >
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block text-body leading-snug break-words">{label}</span>
                    {currentStepLabel && <span className="block text-caption font-medium opacity-75 truncate">{currentStepLabel}</span>}
                  </span>
                  {hasMissing && <span className="mt-0.5 shrink-0 text-caption font-bold px-1.5 rounded-full bg-error-container text-error">Thiếu</span>}
                  {/* Mũi tên luôn hiện (bản cũ chỉ hiện khi rê chuột ⇒ không ai biết dòng mở ra được): xoay 90° và đậm
                      lên khi giai đoạn đang mở. Mục đơn không có bước con nên không có mũi tên. */}
                  {!single && (
                    <Icon
                      name="caret-right"
                      size={13}
                      // Mờ theo tỉ lệ thay vì màu cố định ⇒ mũi tên tự ăn theo màu dòng, kể cả trên ô lavender
                      className={`shrink-0 mt-[3px] transition-[transform,opacity] duration-200 ${open ? "rotate-90 opacity-70" : "opacity-45"}`}
                    />
                  )}
                </button>
                {/* Khối bước lùi 16px; cộng thêm cột chấm 12px + khe 8px + đệm ô chữ 8px ⇒ chữ bước cách chữ giai đoạn 36px */}
                {renderPhaseBody && !single && (
                  <Collapse open={open}>
                    <div className="ml-4 my-1">{renderPhaseBody(phase)}</div>
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
