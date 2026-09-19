"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DECISION_REASON_MIN_LENGTH } from "@/types/change-request";

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  busy?: boolean;
}

/** Hỏi lý do (≥ 10 ký tự như BE) cho huỷ / đóng change request. */
export default function ReasonDialog({ open, title, description, confirmLabel, onConfirm, onClose, busy = false }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < DECISION_REASON_MIN_LENGTH;
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 text-[13px] text-[#4B4842]">
        <p>{description}</p>
        <textarea
          aria-label="Lý do"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={`Lý do (ít nhất ${DECISION_REASON_MIN_LENGTH} ký tự)`}
          className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-[13px]"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-semibold">
            Quay lại
          </button>
          <button
            type="button"
            disabled={tooShort || busy}
            onClick={() => onConfirm(reason.trim())}
            className="px-4 py-2 rounded-[8px] bg-[#B03030] text-white text-[13px] font-bold disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
