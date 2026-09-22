"use client";

import { useState } from "react";
import { stepLabel } from "@/lib/constants/step-registry";
import { isFlagWaivable } from "@/types/flags";
import type { Flag } from "@/types/flags";

const WAIVE_REASON_MIN_LENGTH = 20;

interface WaiveModalProps {
  flag: Flag;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

function WaiveModal({ flag, busy, error, onCancel, onSubmit }: WaiveModalProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= WAIVE_REASON_MIN_LENGTH && !busy;

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-white rounded-[18px] p-5 w-[420px] max-w-[90vw] shadow-[0_30px_80px_rgba(0,0,0,0.3)] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-extrabold text-[13.5px] text-[#191817]">Waive cờ {flag.rule_id}</h4>
        <p className="text-[11.5px] text-[#6B6862] leading-relaxed">{flag.message}</p>
        <label htmlFor="waive-reason" className="text-[11.5px] font-semibold text-[#4B4842]">
          Lý do (tối thiểu {WAIVE_REASON_MIN_LENGTH} ký tự)
        </label>
        <textarea
          id="waive-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-[#E5E3DF] focus:border-[#6A62C4] rounded-[10px] text-[12px] outline-none resize-none"
          placeholder="Vì sao chấp nhận bỏ qua cờ này?"
        />
        <div className="flex items-center justify-between text-[10.5px] text-[#A8A49C]">
          <span>{reason.trim().length}/{WAIVE_REASON_MIN_LENGTH}</span>
        </div>
        {error && <div className="text-[11px] text-[#B03030]">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7] cursor-pointer disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(reason.trim())}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? "Đang lưu…" : "Xác nhận waive"}
          </button>
        </div>
      </div>
    </div>
  );
}

const LEVEL_STYLE: Record<Flag["level"], string> = {
  red: "bg-[#FDEDED] text-[#B03030] border border-[#F2CACA]",
  yellow: "bg-[#FBF4E4] text-[#8A6D1F] border border-[#F0DFB4]",
};

interface FlagsPanelProps {
  flags: Flag[];
  busy?: boolean;
  error?: string | null;
  onWaive: (flagId: string, reason: string) => Promise<void>;
  onRecompute: () => void;
  onSelectStep?: (stepId: string) => void;
  /** Vẽ lại sơ đồ của cờ `diagram_stale` / `render_error` (BUG-17). */
  onRedraw?: (flag: Flag) => Promise<void> | void;
}

const isOpen = (flag: Flag): boolean => !flag.resolved_at && !flag.waived_by_user;

/**
 * BUG-34: cờ đỏ luôn đứng trước cờ vàng, rồi tới thứ tự step xử lý. Panel cũ xếp theo thứ tự BE trả về
 * nên cờ vàng che mất cờ đỏ — thứ chặn ký baseline lại nằm dưới thứ không chặn.
 */
export const sortFlags = (flags: readonly Flag[]): Flag[] =>
  [...flags].sort((a, b) => {
    if (a.level !== b.level) return a.level === "red" ? -1 : 1;
    if (a.remediation_step !== b.remediation_step) return a.remediation_step < b.remediation_step ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

/** Cờ mà việc cần làm là vẽ lại sơ đồ, không phải sửa nội dung. */
export const isRedrawable = (flag: Flag): boolean => flag.rule_id === "diagram_stale" || flag.rule_id === "render_error";

/** Bảng cờ đỏ/vàng (`GET /flags`); waive luật `array_empty`/`dead_reference`/`render_error` bị khoá. */
export default function FlagsPanel({ flags, busy = false, error, onWaive, onRecompute, onSelectStep, onRedraw }: FlagsPanelProps) {
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveError, setWaiveError] = useState<string | null>(null);
  const openFlags = sortFlags(flags.filter(isOpen));
  const [redrawing, setRedrawing] = useState<string | null>(null);
  const waivedFlags = flags.filter((f) => f.waived_by_user);
  const waivingFlag = waivingId ? flags.find((f) => f.id === waivingId) : undefined;

  const openWaiveModal = (flagId: string) => {
    setWaiveError(null);
    setWaivingId(flagId);
  };

  const closeWaiveModal = () => {
    setWaiveError(null);
    setWaivingId(null);
  };

  // `onWaive` (từ `useFlags`) ném lỗi khi BE từ chối — bắt tại đây để không rơi vào unhandled
  // rejection (trước đây `void submitWaive(...)` không có try/catch) và giữ modal mở để user sửa lại.
  const submitWaive = async (reason: string) => {
    if (!waivingFlag) return;
    setWaiveError(null);
    try {
      await onWaive(waivingFlag.id, reason);
      setWaivingId(null);
    } catch (err) {
      setWaiveError(err instanceof Error ? err.message : "Waive cờ thất bại");
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Danh sách cờ">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-extrabold text-[#8A867E] tracking-wider uppercase">
          Cờ đang mở ({openFlags.length})
        </h4>
        <button
          type="button"
          onClick={onRecompute}
          disabled={busy}
          className="px-2.5 py-1 rounded-full text-[10.5px] font-bold border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer flex items-center gap-1"
        >
          <span>↻</span>
          <span>Recompute</span>
        </button>
      </div>

      {error && <div className="text-[11px] text-[#B03030]">{error}</div>}

      {openFlags.length === 0 ? (
        <div className="text-[11.5px] text-[#A8A49C] italic py-2">Không có cờ nào đang mở.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {openFlags.map((flag) => (
            <div key={flag.id} className="bg-white border border-[#ECEAE5] rounded-[12px] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase ${LEVEL_STYLE[flag.level]}`}>
                  {flag.level}
                </span>
                <span className="font-mono text-[10px] text-[#8A867E] truncate">{flag.rule_id}</span>
              </div>
              <div className="text-[11px] text-[#6B6862]">
                Section: <span className="font-mono">{flag.section_id}</span>
              </div>
              <p className="text-[11.5px] text-[#33312D] leading-relaxed">{flag.message}</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                {onSelectStep ? (
                  <button
                    type="button"
                    onClick={() => onSelectStep(flag.remediation_step)}
                    className="text-[10.5px] font-bold text-[#6A62C4] hover:underline cursor-pointer"
                  >
                    → {flag.remediation_step} · {stepLabel(flag.remediation_step)}
                  </button>
                ) : (
                  <span className="text-[10.5px] text-[#8A867E]">{flag.remediation_step}</span>
                )}
                <div className="flex items-center gap-1.5">
                {onRedraw && isRedrawable(flag) && (
                  <button
                    type="button"
                    disabled={busy || redrawing === flag.id}
                    onClick={async () => {
                      setRedrawing(flag.id);
                      try {
                        await onRedraw(flag);
                      } finally {
                        setRedrawing(null);
                      }
                    }}
                    className="px-2.5 py-1 rounded-full text-[10.5px] font-bold border border-[#DCD8F0] text-[#6A62C4] bg-[#F2F1FB] hover:bg-[#E8E6F8] disabled:opacity-50 cursor-pointer"
                  >
                    {redrawing === flag.id ? "Đang vẽ…" : "Vẽ lại"}
                  </button>
                )}
                {isFlagWaivable(flag.rule_id) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openWaiveModal(flag.id)}
                    className="px-2.5 py-1 rounded-full text-[10.5px] font-bold border border-[#F0DFB4] text-[#8A6D1F] bg-[#FBF4E4] hover:bg-[#F7EBCF] disabled:opacity-50 cursor-pointer"
                  >
                    Waive
                  </button>
                ) : (
                  <span className="text-[10px] text-[#A8A49C] italic" title="Luật này không cho waive">
                    Không thể waive
                  </span>
                )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {waivedFlags.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10.5px] font-bold text-[#8A867E] cursor-pointer">
            Đã waive ({waivedFlags.length})
          </summary>
          <div className="flex flex-col gap-1.5 mt-1.5">
            {waivedFlags.map((flag) => (
              <div key={flag.id} className="text-[11px] text-[#6B6862] bg-[#FAF9F7] rounded-[8px] p-2">
                <span className="font-mono text-[10px]">{flag.rule_id}</span> — {flag.waive_reason}
              </div>
            ))}
          </div>
        </details>
      )}

      {waivingFlag && (
        <WaiveModal
          flag={waivingFlag}
          busy={busy}
          error={waiveError}
          onCancel={closeWaiveModal}
          onSubmit={(reason) => void submitWaive(reason)}
        />
      )}
    </div>
  );
}
