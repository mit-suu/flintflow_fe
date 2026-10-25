"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("mode1.reasonDialog");
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < DECISION_REASON_MIN_LENGTH;
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 text-body text-[#4B4842]">
        <p>{description}</p>
        <textarea
          aria-label={t("reasonAria")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t("placeholder", { min: DECISION_REASON_MIN_LENGTH })}
          className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-body"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-body font-semibold">
            {t("back")}
          </button>
          <button
            type="button"
            disabled={tooShort || busy}
            onClick={() => onConfirm(reason.trim())}
            className="px-4 py-2 rounded-[8px] bg-[#B03030] text-white text-body font-bold disabled:opacity-50"
          >
            {busy ? t("busy") : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
