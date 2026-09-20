"use client";

import { useState } from "react";
import { REGENERATE_LIMIT, stepLabel } from "@/lib/constants/step-registry";
import type { GateAction } from "@/types/pipeline";

interface GateCardProps {
  stepId: string;
  /** Hành động BE cho phép (sự kiện `gate_ready`). */
  actions: GateAction[];
  regenerateUsed: number;
  regenerateLimit?: number;
  busy?: boolean;
  /** Fast path: một GateCard gộp cuối phase. */
  phaseLabel?: string;
  /** Lượt chạy vừa rồi có ghi được op nào vào Spine không (L11b). */
  wroteOps?: boolean;
  /** Mục step này nuôi mà chạy xong vẫn trống — accept cũng không đóng được cờ `section_empty` (L11b). */
  emptySections?: { section_id: string; title: string }[];
  onAction: (action: GateAction, note?: string) => void;
}

/**
 * Cổng chốt (Phases §3): Accept · Request revision (ghi chú) · Regenerate (n/3, tắt khi hết) ·
 * Accept as-is (chỉ khi hết Regenerate hoặc BE mở, bắt buộc lý do).
 */
export default function GateCard({
  stepId,
  actions,
  regenerateUsed,
  regenerateLimit = REGENERATE_LIMIT,
  busy = false,
  phaseLabel,
  wroteOps = true,
  emptySections = [],
  onAction,
}: GateCardProps) {
  const [mode, setMode] = useState<"revision" | "accept_as_is" | null>(null);
  const [note, setNote] = useState("");

  const regenerateLeft = regenerateUsed < regenerateLimit && actions.includes("regenerate");
  const showAcceptAsIs = actions.includes("accept_as_is") || regenerateUsed >= regenerateLimit;
  const noteRequired = mode !== null;
  const canSubmitNote = note.trim().length > 0 && !busy;

  const submitNote = () => {
    if (!mode || !canSubmitNote) return;
    onAction(mode, note.trim());
    setNote("");
    setMode(null);
  };

  return (
    <div className="bg-white border-2 border-[#DCD8F0] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(106,98,196,0.08)]" aria-label="Cổng chốt">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold text-[#6A62C4] tracking-wider uppercase">Cổng chốt</div>
          <h4 className="font-extrabold text-[13px] text-[#191817]">{phaseLabel ?? `${stepId} · ${stepLabel(stepId)}`}</h4>
        </div>
        <span className="text-[11px] font-bold text-[#6B6862]" data-testid="regenerate-count">
          Regenerate {regenerateUsed}/{regenerateLimit}
        </span>
      </div>

      {/* L11b: trước đây lô op rỗng vẫn tới gate y như một lượt chạy thành công — user Accept, cờ đỏ vẫn treo,
          bấm "Mở lại" lại rơi vào đúng vòng đó. Nói thẳng ra ở đây kèm lối khác. */}
      {(!wroteOps || emptySections.length > 0) && (
        <div role="status" className="bg-[#FBF4E4] border border-[#F0DFB4] rounded-[12px] px-3 py-2.5 flex flex-col gap-1 text-[11.5px] text-[#8A6D1F]">
          <p className="font-bold text-[#191817]">
            {wroteOps ? "Chạy xong nhưng mục vẫn trống" : "AI không soạn được nội dung nào ở lượt này"}
          </p>
          {emptySections.length > 0 && (
            <p>
              Còn trống:{" "}
              {emptySections.map((s) => (
                <span key={s.section_id} className="font-semibold text-[#33312D]">
                  {s.title}{" "}
                  <code className="text-[10.5px]">{s.section_id}</code>
                </span>
              ))}
              . Accept sẽ chốt bước nhưng cờ đỏ <code>section_empty</code> vẫn treo, và chạy lại cũng cho kết quả như
              vậy nếu tài liệu gốc không có dữ liệu cho mục đó.
            </p>
          )}
          <p>
            Lối khác: <b>Request revision</b> để tả rõ cần gì, tự viết nội dung qua chat, hoặc waive cờ ở panel
            Verification nếu mục này thật sự không áp dụng.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !actions.includes("accept")}
          onClick={() => onAction("accept")}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#1F7A45] text-white hover:bg-[#19663A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✓ Accept
        </button>
        <button
          type="button"
          disabled={busy || !actions.includes("revision")}
          onClick={() => setMode(mode === "revision" ? null : "revision")}
          aria-pressed={mode === "revision"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✎ Request revision
        </button>
        <button
          type="button"
          disabled={busy || !regenerateLeft}
          onClick={() => onAction("regenerate")}
          title={regenerateLeft ? undefined : "Đã hết lượt Regenerate"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DCD8F0] text-[#6A62C4] hover:bg-[#F2F1FB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ↻ Regenerate ({regenerateUsed}/{regenerateLimit})
        </button>
        {showAcceptAsIs && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === "accept_as_is" ? null : "accept_as_is")}
            aria-pressed={mode === "accept_as_is"}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#F0DFB4] text-[#8A6D1F] bg-[#FBF4E4] hover:bg-[#F7EBCF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Accept as-is
          </button>
        )}
      </div>

      {noteRequired && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`gate-note-${stepId}`} className="text-[11.5px] font-semibold text-[#6B6862]">
            {mode === "revision" ? "Cần sửa gì?" : "Lý do chấp nhận bản hiện tại (bắt buộc)"}
          </label>
          <textarea
            id={`gate-note-${stepId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#6A62C4] rounded-[10px] text-[12px] outline-none resize-none"
          />
          <button
            type="button"
            disabled={!canSubmitNote}
            onClick={submitNote}
            className="self-end px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mode === "revision" ? "Gửi yêu cầu sửa" : "Xác nhận Accept as-is"}
          </button>
        </div>
      )}
    </div>
  );
}
