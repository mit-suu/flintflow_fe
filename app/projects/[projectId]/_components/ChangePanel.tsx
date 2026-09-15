"use client";

import { useEffect, useState } from "react";
import { useChanges } from "../hooks/useChanges";
import DiffPreviewModal from "./DiffPreviewModal";
import TraceabilityMap from "./TraceabilityMap";
import type { ApplyResult } from "@/types/pipeline";

export interface ChangeSeed {
  text: string;
  /** Tăng mỗi lần gửi để `useEffect` phát hiện lệnh mới kể cả khi trùng nội dung. */
  nonce: number;
}

interface ChangePanelProps {
  projectId: string;
  getBaseVersion: () => number | null;
  onApplied: (result: ApplyResult, impactedSectionIds?: string[]) => void;
  onClose: () => void;
  /** Lệnh sửa forward từ ChatPane khi session hiện tại không phải pipeline session. */
  seed?: ChangeSeed;
}

/** Change panel (UC 6.8–6.11): ô lệnh → preview diff → xác nhận; hoà giải; undo; lịch sử; traceability. */
export default function ChangePanel({ projectId, getBaseVersion, onApplied, onClose, seed }: ChangePanelProps) {
  const [instruction, setInstruction] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showTraceability, setShowTraceability] = useState(false);
  const {
    preview,
    previewing,
    applying,
    clarification,
    error,
    history,
    historyLoading,
    requestPreview,
    confirmPreview,
    cancelPreview,
    reconcileOnce,
    undo,
    loadHistory,
  } = useChanges(projectId, getBaseVersion, onApplied);

  useEffect(() => {
    if (!seed?.text) return;
    // Lùi một microtask: đồng bộ với hệ thống ngoài (gọi preview qua BE), không setState đồng bộ
    // ngay trong effect. Chỉ theo dõi `nonce` — cùng text gửi lại lần nữa vẫn phải preview lại.
    queueMicrotask(() => {
      setInstruction(seed.text);
      void requestPreview(seed.text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  const submit = () => {
    if (!instruction.trim() || previewing) return;
    void requestPreview(instruction);
  };

  return (
    <aside className="w-[380px] flex-none bg-[#FAF9F7] border-l border-[#ECEAE5] flex flex-col overflow-hidden z-10" aria-label="Change panel">
      <div className="p-3.5 border-b border-[#ECEAE5] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#4F46E5] font-bold">✎</span>
          <h3 className="font-extrabold text-[13px] text-[#191817]">Sửa qua lệnh</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#F5F3F0] rounded-[6px] text-[#8A867E] hover:text-[#191817] cursor-pointer">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="change-instruction" className="text-[11px] font-extrabold text-[#8A867E] tracking-wider uppercase">
            Lệnh sửa
          </label>
          <textarea
            id="change-instruction"
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ví dụ: Đổi tên actor A03 thành Administrator"
            className="w-full px-3 py-2 border border-[#E5E3DF] focus:border-[#4F46E5] rounded-[10px] text-[12px] outline-none resize-none bg-white"
          />
          <button
            type="button"
            disabled={!instruction.trim() || previewing}
            onClick={submit}
            className="self-end px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-[#191817] text-white disabled:opacity-50 cursor-pointer"
          >
            {previewing ? "Đang xem trước…" : "Xem trước thay đổi"}
          </button>
        </div>

        {clarification && (
          <div className="bg-[#F4F3FE] border border-[#DDD9F6] rounded-[12px] p-3 text-[11.5px] text-[#3B34B0]">
            <div className="font-bold mb-1">Cần làm rõ</div>
            {clarification}
          </div>
        )}

        {error && <div className="text-[11px] text-[#B03030]">{error}</div>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={applying}
            onClick={() => void reconcileOnce()}
            className="flex-1 px-3 py-1.5 rounded-full text-[11px] font-bold border border-[#ECEAE5] bg-white text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
            title="Gộp các thay đổi treo (nếu có) thành một lô, xem trước rồi áp"
          >
            Hoà giải một lượt
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={() => void undo()}
            className="flex-1 px-3 py-1.5 rounded-full text-[11px] font-bold border border-[#ECEAE5] bg-white text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
          >
            Undo op cuối
          </button>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-[#ECEAE5] pt-3">
          <button
            type="button"
            onClick={() => {
              setShowHistory((v) => !v);
              if (!showHistory) void loadHistory();
            }}
            className="self-start text-[11px] font-bold text-[#4F46E5] hover:underline cursor-pointer"
          >
            {showHistory ? "Ẩn lịch sử thay đổi" : "Xem lịch sử thay đổi (20 dòng)"}
          </button>
          {showHistory && (
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
              {historyLoading && <div className="text-[11px] text-[#A8A49C] italic">Đang tải…</div>}
              {!historyLoading && history.length === 0 && (
                <div className="text-[11px] text-[#A8A49C] italic">Chưa có lịch sử qua Change panel.</div>
              )}
              {history.map((change) => (
                <div key={`${change.txn}:${change.seq}`} className="text-[10.5px] text-[#6B6862] bg-white border border-[#ECEAE5] rounded-[8px] p-2">
                  <span className="font-mono">#{change.seq}</span> <span className="font-bold">{change.op}</span>{" "}
                  <span className="font-mono">{change.path}</span>
                  {change.reason && <div className="text-[#A8A49C] italic mt-0.5">{change.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-[#ECEAE5] pt-3">
          <button
            type="button"
            onClick={() => setShowTraceability((v) => !v)}
            className="self-start text-[11px] font-bold text-[#4F46E5] hover:underline cursor-pointer"
          >
            {showTraceability ? "Ẩn traceability" : "Tra traceability"}
          </button>
          {showTraceability && <TraceabilityMap projectId={projectId} />}
        </div>
      </div>

      {preview && <DiffPreviewModal preview={preview} busy={applying} onCancel={cancelPreview} onConfirm={() => void confirmPreview()} />}
    </aside>
  );
}
