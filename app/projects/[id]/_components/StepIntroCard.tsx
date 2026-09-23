"use client";

import { getStepDef, stepLabel } from "@/lib/constants/step-registry";
import type { StepSummary } from "@/types/pipeline";

/**
 * Lớp 2 "Bước này sẽ…" (`03-live-status-flow.md`): trước khi bấm Chạy, user phải biết **bước này làm gì,
 * dùng lại gì của bước trước, và có thể bị hỏi gì**. Không có nó, mỗi lần bấm Chạy là một lần trả tiền cho
 * một việc không rõ ràng.
 *
 * Ước lượng thời gian và credit KHÔNG bịa: chỉ hiện khi đã có lần chạy thật của chính bước đó (gate trả
 * `duration_ms`/`credits_used`, được nhớ lại ở `lib/step-stats.ts`).
 */

export interface StepStat {
  duration_ms: number;
  credits: number;
}

interface StepIntroCardProps {
  step: StepSummary;
  /** Số liệu lần chạy gần nhất của chính bước này (nếu từng chạy). */
  lastRun?: StepStat | null;
  busy?: boolean;
  onRun?: () => void;
  /** Chạy liền cả giai đoạn (R2) — chỉ hiện khi chế độ duyệt cho phép. */
  onRunPhase?: () => void;
}

/** `functions[screen_id=@loop]:id,name` → `functions`; đọc được cho người. */
const READ_LABELS: Record<string, string> = {
  project: "thông tin dự án",
  features: "nhóm chức năng",
  actors: "actor",
  roles: "vai trò",
  use_cases: "use case",
  screens: "màn hình",
  permissions: "ma trận quyền",
  entities: "thực thể",
  functions: "chức năng",
  nfrs: "yêu cầu phi chức năng",
  business_rules: "quy tắc nghiệp vụ",
  messages: "thông điệp",
  glossary: "thuật ngữ",
  addendum: "ghi chú Brief",
  assumptions: "giả định",
  documents: "tài liệu bạn tải lên",
  progress: "tiến độ",
};

export const readableInputs = (reads: readonly string[]): string[] => {
  const seen = new Set<string>();
  for (const raw of reads) {
    const root = /^[a-z_]+/.exec(raw)?.[0];
    if (root && READ_LABELS[root]) seen.add(READ_LABELS[root]);
  }
  return [...seen];
};

export const formatEstimate = (stat: StepStat): string => {
  const seconds = Math.round(stat.duration_ms / 1000);
  const time = seconds < 90 ? `khoảng ${Math.max(10, Math.round(seconds / 10) * 10)} giây` : `khoảng ${Math.round(seconds / 60)} phút`;
  return `Lần trước mất ${time} · ${Math.round(stat.credits)} credit`;
};

export default function StepIntroCard({ step, lastRun, busy = false, onRun, onRunPhase }: StepIntroCardProps) {
  const def = getStepDef(step.id);
  if (!def) return null;

  return (
    <section className="bg-white border border-[#ECEAE5] rounded-[12px] p-3 flex flex-col gap-2" aria-label="Giới thiệu bước">
      <h4 className="text-[12px] font-bold text-[#191817]">
        {step.id} · {stepLabel(step.id)}
      </h4>
      <p className="text-[11.5px] text-[#4B4842]">Bước này sẽ: {def.description}</p>
      {readableInputs(def.reads).length > 0 && (
        <p className="text-[11.5px] text-[#6B6862]">Dùng lại: {readableInputs(def.reads).join(", ")}.</p>
      )}
      {!def.deterministic && <p className="text-[11.5px] text-[#6B6862]">Bạn có thể được hỏi vài câu trước khi AI soạn.</p>}
      {lastRun && <p className="text-[11px] text-[#8A867E]">{formatEstimate(lastRun)}</p>}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {onRun && (
          <button
            type="button"
            disabled={busy}
            onClick={onRun}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#6A62C4] text-white hover:bg-[#5B54AC] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Chạy bước này
          </button>
        )}
        {onRunPhase && (
          <button
            type="button"
            disabled={busy}
            onClick={onRunPhase}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DCD8F0] text-[#6A62C4] hover:bg-[#F2F1FB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Chạy liền các bước của giai đoạn này; chỉ dừng khi cần bạn"
          >
            Chạy cả giai đoạn
          </button>
        )}
      </div>
    </section>
  );
}
