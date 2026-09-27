"use client";

import { useEffect, useState } from "react";
import type { ChangeSummary, RunStage, StepEvent } from "@/types/pipeline";
import type { RunnerState } from "../hooks/useStepRunner";
import RunActivityLog from "./RunActivityLog";
import { activityLines } from "./activity-log";

/**
 * Lớp 3 "Tiến trình trực tiếp" (`03-live-status-flow.md`): trong lúc chờ, màn hình phải trả lời được
 * *đang làm gì · còn bao lâu · có bị treo không · tôi có cần làm gì không*.
 *
 * Không bịa tiến độ: mọi dòng ở đây lấy từ tín hiệu thật của runner (stage, lô function, số op đã ghi,
 * heartbeat). Đồng hồ đếm thời gian thật; "chậm hơn thường lệ" chỉ dựa trên khoảng lặng thật sự.
 *
 * Hiển thị như bong bóng "AI đang suy nghĩ" của các chatbot: một dòng việc đang làm + chấm nhấp nháy;
 * nút "Chạy nền"/"Huỷ lượt" chỉ hiện khi rê chuột hoặc khi chạy chậm. Tóm tắt thay đổi nằm ở cổng duyệt.
 */

const STAGE_ORDER: { stage: RunStage; label: string }[] = [
  { stage: "intake", label: "Đọc dữ liệu" },
  { stage: "ask", label: "Hỏi bạn" },
  { stage: "draft", label: "AI soạn" },
  { stage: "check", label: "Kiểm tra" },
  { stage: "render", label: "Vẽ hình" },
  { stage: "gate", label: "Chờ bạn duyệt" },
];

/** Câu ngắn cho dòng "AI đang làm gì" — lời thường, không lộ tên giai đoạn nội bộ. */
const WORKING_TEXT: Record<RunStage, string> = {
  intake: "Đang đọc dữ liệu dự án…",
  ask: "Đang xem còn thiếu gì…",
  draft: "Đang soạn nội dung…",
  check: "Đang kiểm tra…",
  render: "Đang vẽ sơ đồ…",
  gate: "Đã xong, chờ bạn duyệt",
};

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

  const quiet = state.lastEventAt ? now - state.lastEventAt : 0;
  const slow = state.busy && quiet > SLOW_AFTER_MS;

  const working = state.busy || state.status === "reconnecting";
  // FLF-221: nhật ký hoạt động thay dòng loading — trừ lúc mất kết nối/gián đoạn, khi câu báo trạng thái quan trọng hơn
  const showLog = state.status !== "reconnecting" && state.status !== "interrupted" && activityLines(state.events, working).length > 0;
  // Đang chờ user trả lời: thẻ hỏi đã nói rõ tới lượt ai — chỉ còn nhật ký những việc đã làm, không có dòng nào khác.
  if (state.status === "needs_input" && !showLog) return null;
  const headline =
    state.status === "reconnecting"
      ? "Mất kết nối với lượt chạy, đang kết nối lại…"
      : state.status === "interrupted"
        ? "Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ."
        : [WORKING_TEXT[state.stage ?? "intake"], state.batch ? `lô ${state.batch.i}/${state.batch.n}` : null].filter(Boolean).join(" · ");
  // Nút chỉ cần khi user muốn làm gì đó với lượt chạy: rê chuột/focus vào bong bóng, hoặc tự hiện khi chạy chậm
  const actionsClass = slow ? "flex" : "hidden group-hover:flex group-focus-within:flex";

  return (
    <section className="group flex items-start gap-3" aria-label="Tiến trình bước">
      <div
        aria-hidden
        className="w-7 h-7 rounded-[9px] text-white flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#8E87D6,#6A62C4)" }}
      >
        F
      </div>
      <div className="flex-1 min-w-0 pt-1 flex flex-col gap-1.5">
        <div className="flex items-start gap-2 min-w-0">
          {showLog ? (
            <div className="flex-1 min-w-0" role="status" aria-live="polite">
              <RunActivityLog events={state.events} running={working} />
            </div>
          ) : (
          <div className="flex-1 min-w-0 flex items-center gap-2">
          {working && (
            <span className="flex items-center gap-1 shrink-0" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="w-1.5 h-1.5 rounded-full bg-[#6A62C4] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
          )}
          <p
            role="status"
            className={`flex-1 min-w-0 truncate text-[12.5px] ${state.status === "interrupted" ? "text-[#B03030]" : "text-[#33312D]"}`}
          >
            {headline}
          </p>
          </div>
          )}
          <div className={`${actionsClass} items-center gap-2 shrink-0`}>
          {working && onBackground && (
            <button
              type="button"
              onClick={onBackground}
              className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F2F1EE] text-[#191817] hover:bg-[#E9E7E2] cursor-pointer"
            >
              Chạy nền
            </button>
          )}
          {working && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF2F2] text-[#B03030] hover:bg-[#FBE4E4] cursor-pointer"
            >
              Huỷ lượt
            </button>
          )}
          </div>
        </div>

        {slow && state.status !== "reconnecting" && (
          <p className="text-[11.5px] text-[#6B6862]" role="status">
            AI phản hồi chậm hơn thường lệ, vẫn đang chạy.
          </p>
        )}

        {state.retry && (
          <p className="text-[11.5px] text-[#8A6D1F] bg-[#FBF4E4] rounded-[8px] px-2 py-1">
            AI trả {state.retry.reason}, đang thử lại (lần {state.retry.attempt}/{state.retry.max}).
          </p>
        )}

      </div>
    </section>
  );
}
