"use client";

import { useEffect, useState } from "react";
import { stepLabel } from "@/lib/constants/step-registry";
import type { ChangeSummary, RunStage, StepEvent } from "@/types/pipeline";
import type { RunnerState } from "../hooks/useStepRunner";

/**
 * Lớp 3 "Tiến trình trực tiếp" (`03-live-status-flow.md`): trong lúc chờ, màn hình phải trả lời được
 * *đang làm gì · còn bao lâu · có bị treo không · tôi có cần làm gì không*.
 *
 * Không bịa tiến độ: mọi dòng ở đây lấy từ tín hiệu thật của runner (stage, lô function, số op đã ghi,
 * heartbeat). Đồng hồ đếm thời gian thật; "chậm hơn thường lệ" chỉ dựa trên khoảng lặng thật sự.
 */

const STAGE_ORDER: { stage: RunStage; label: string }[] = [
  { stage: "intake", label: "Đọc dữ liệu" },
  { stage: "ask", label: "Hỏi bạn" },
  { stage: "draft", label: "AI soạn" },
  { stage: "check", label: "Kiểm tra" },
  { stage: "render", label: "Vẽ hình" },
  { stage: "gate", label: "Chờ bạn duyệt" },
];

/** Giai đoạn nào thật sự có trong lượt này: các stage đã đi qua + stage đang chạy + "chờ duyệt". */
export const visibleStages = (events: StepEvent[], current: RunStage | null): RunStage[] => {
  const seen = new Set<RunStage>(events.flatMap((e) => (e.type === "stage" ? [e.stage] : [])));
  if (current) seen.add(current);
  seen.add("gate");
  return STAGE_ORDER.filter((s) => seen.has(s.stage)).map((s) => s.stage);
};

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };

export const summaryLine = (row: ChangeSummary): string => `${PREFIX[row.kind]} ${row.title_vi}`;

/** Quá lâu không có tín hiệu nào ⇒ nói thẳng là chậm, và mời huỷ (03 §3). */
export const SLOW_AFTER_MS = 20_000;

interface StepProgressProps {
  state: RunnerState;
  onCancel?: () => void;
  /** Thu gọn thành pill góc màn hình để user đi làm việc khác (Lớp 5). */
  onBackground?: () => void;
}

export default function StepProgress({ state, onCancel, onBackground }: StepProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = state.busy || state.status === "needs_input" || state.status === "reconnecting";

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  if (state.stepId === null || state.status === "idle") return null;

  const stages = visibleStages(state.events, state.stage);
  const currentIndex = state.stage ? stages.indexOf(state.stage) : -1;
  const elapsed = state.startedAt ? now - state.startedAt : 0;
  const quiet = state.lastEventAt ? now - state.lastEventAt : 0;
  const slow = state.busy && quiet > SLOW_AFTER_MS;
  const recent = state.summary.slice(-3);

  return (
    <section className="bg-white border border-[#ECEAE5] rounded-[12px] p-3 flex flex-col gap-2" aria-label="Tiến trình bước">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-[12px] font-bold text-[#191817] truncate">
          {state.stepId} · {stepLabel(state.stepId)}
        </h4>
        <span className="text-[11px] font-mono text-[#6B6862]" aria-label="Thời gian đã chạy">
          {formatDuration(elapsed)}
        </span>
      </header>

      <ol className="flex flex-col gap-1">
        {stages.map((stage, index) => {
          const done = currentIndex > index;
          const active = currentIndex === index;
          const label = STAGE_ORDER.find((s) => s.stage === stage)?.label ?? stage;
          return (
            <li key={stage} className={`text-[11.5px] flex items-start gap-2 ${active ? "text-[#191817] font-semibold" : done ? "text-[#4B4842]" : "text-[#9A968E]"}`}>
              <span aria-hidden className="shrink-0">
                {done ? "✓" : active ? "◉" : "○"}
              </span>
              <span className="min-w-0">
                {label}
                {active && state.detail ? <span className="font-normal"> · {state.detail}</span> : null}
                {active && state.batch ? <span className="font-normal"> · lô {state.batch.i}/{state.batch.n}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {state.retry && (
        <p className="text-[11.5px] text-[#8A6D1F] bg-[#FBF4E4] rounded-[8px] px-2 py-1">
          AI trả {state.retry.reason}, đang thử lại (lần {state.retry.attempt}/{state.retry.max}).
        </p>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B6862]">Vừa ghi</span>
          {recent.map((row, i) => (
            <span key={`${row.collection}-${row.id ?? i}`} className="text-[11.5px] text-[#4B4842] truncate">
              {summaryLine(row)}
            </span>
          ))}
          {state.summary.length > recent.length && (
            <span className="text-[11px] text-[#6B6862]">và {state.summary.length - recent.length} thay đổi khác</span>
          )}
        </div>
      )}

      {state.status === "needs_input" && (
        <p className="text-[11.5px] font-bold text-[#6A62C4]" role="status">
          Đến lượt bạn — trả lời câu hỏi bên dưới để AI soạn tiếp.
        </p>
      )}

      {slow && state.status !== "reconnecting" && (
        <p className="text-[11.5px] text-[#6B6862]" role="status">
          AI phản hồi chậm hơn thường lệ, vẫn đang chạy.
        </p>
      )}

      {state.status === "reconnecting" && (
        <p className="text-[11.5px] text-[#8A6D1F]" role="status">
          Mất kết nối với lượt chạy, đang kết nối lại…
        </p>
      )}

      {state.status === "interrupted" && (
        <p className="text-[11.5px] text-[#B03030]" role="status">
          Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ.
        </p>
      )}

      {(state.busy || slow) && (onCancel || onBackground) && (
        <div className="flex gap-2 pt-0.5">
          {onBackground && (
            <button
              type="button"
              onClick={onBackground}
              className="px-2.5 py-1 rounded-full text-[11.5px] font-bold border border-[#ECEAE5] text-[#191817] hover:bg-[#FAF9F7] cursor-pointer"
            >
              Chạy nền
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 rounded-full text-[11.5px] font-bold border border-[#F0C4C4] text-[#B03030] hover:bg-[#FDF2F2] cursor-pointer"
            >
              Huỷ lượt
            </button>
          )}
        </div>
      )}
    </section>
  );
}
