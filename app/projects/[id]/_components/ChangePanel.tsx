"use client";

import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useEffect, useRef, useState } from "react";
import { useChanges } from "../hooks/useChanges";
import DiffPreviewModal from "./DiffPreviewModal";
import TraceabilityMap from "./TraceabilityMap";
import type { ApplyResult } from "@/types/pipeline";

export interface ChangeSeed {
  text: string;
  /** Tăng mỗi lần gửi để phát hiện lệnh mới kể cả khi trùng nội dung. */
  nonce: number;
}

interface ChangePanelProps {
  projectId: string;
  getBaseVersion: () => number | null;
  /** Seq lớn nhất đã biết của Spine — dùng giới hạn `GET /changes` về 20 dòng gần nhất. */
  getLatestSeq: () => number | null;
  onApplied: (result: ApplyResult, impactedSectionIds?: string[]) => void;
  onClose: () => void;
  /** Lệnh sửa forward từ ChatPane khi session hiện tại không phải pipeline session. */
  seed?: ChangeSeed;
}

/** Change panel (UC 6.8–6.11): ô lệnh → preview diff → xác nhận; hoà giải; undo; lịch sử; traceability. */
export default function ChangePanel({ projectId, getBaseVersion, getLatestSeq, onApplied, onClose, seed }: ChangePanelProps) {
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
  } = useChanges(projectId, getBaseVersion, getLatestSeq, onApplied);

  // Chặn chạy lại lệnh cũ khi panel mở lại với cùng `seed` (vd `seed.nonce` không đổi giữa hai lần
  // mount, hoặc effect re-run vì tham chiếu `seed` đổi mà nonce thì không) — chỉ preview khi gặp
  // `nonce` mới thật sự.
  const handledNonceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!seed?.text || seed.nonce === handledNonceRef.current) return;
    handledNonceRef.current = seed.nonce;
    setInstruction(seed.text);
    void requestPreview(seed.text);
  }, [seed, requestPreview]);

  const submit = () => {
    if (!instruction.trim() || previewing) return;
    void requestPreview(instruction);
  };

  return (
    <aside className="w-[380px] h-full flex-none bg-surface-container-low rounded-l-dialog flex flex-col overflow-hidden" aria-label="Change panel">
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container-low)] h-12 pl-4 pr-2 bg-surface-container-low flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="pencil" size={16} className="text-primary" />
          <h3 className="font-bold text-[13px] text-on-surface truncate">Sửa tài liệu có xem trước</h3>
        </div>
        <IconButton icon="close" size="sm" label="Đóng panel sửa" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="change-instruction" className="text-[12px] font-bold text-on-surface-muted">
            Lệnh sửa
          </label>
          <textarea
            id="change-instruction"
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ví dụ: Đổi tên actor A03 thành Administrator"
            // Cùng kiểu ô nhập của khung chat nhưng phẳng (nằm trong panel): nền trắng, bo lớn, không viền/bóng, vòng tím khi gõ
            className="w-full px-3.5 py-3 rounded-card text-[12.5px] text-on-surface placeholder:text-on-surface-subtle outline-none resize-none bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 transition-shadow ff-scroll"
          />
          <Button size="sm" disabled={!instruction.trim() || previewing} onClick={submit} className="self-end">
            {previewing ? "Đang xem trước…" : "Xem trước thay đổi"}
          </Button>
        </div>

        {clarification && (
          <div className="bg-primary-soft rounded-control p-3 text-[12px] text-primary-hover">
            <div className="font-bold mb-1">Cần làm rõ</div>
            {clarification}
          </div>
        )}

        {error && <div className="text-[12px] text-error">{error}</div>}

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={applying}
            onClick={() => void reconcileOnce()}
            className="flex-1"
            title="Gộp các thay đổi treo (nếu có) thành một lô, xem trước rồi áp"
          >
            Hoà giải một lượt
          </Button>
          <Button variant="secondary" size="sm" disabled={applying} onClick={() => void undo()} className="flex-1">
            Undo op cuối
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setShowHistory((v) => !v);
              if (!showHistory) void loadHistory();
            }}
            className="self-start text-[12px] font-bold text-primary hover:underline cursor-pointer"
          >
            {showHistory ? "Ẩn lịch sử thay đổi" : "Xem lịch sử thay đổi (20 dòng)"}
          </button>
          {showHistory && (
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto ff-scroll">
              {historyLoading && <div className="text-[11.5px] text-on-surface-subtle italic">Đang tải…</div>}
              {!historyLoading && history.length === 0 && (
                <div className="text-[11.5px] text-on-surface-subtle italic">Chưa có lịch sử qua Change panel.</div>
              )}
              {history.map((change) => (
                <div key={`${change.txn}:${change.seq}`} className="text-[11px] text-on-surface-variant bg-surface-container-lowest rounded-inner p-2">
                  <span className="font-mono">#{change.seq}</span> <span className="font-bold">{change.op}</span>{" "}
                  <span className="font-mono">{change.path}</span>
                  {change.reason && <div className="text-on-surface-subtle italic mt-0.5">{change.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => setShowTraceability((v) => !v)}
            className="self-start text-[12px] font-bold text-primary hover:underline cursor-pointer"
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
