"use client";

import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";

interface ConfirmLatestModalProps {
  open: boolean;
  fileName: string;
  onConfirm: () => void;
  /** Chọn file khác thay vì xác nhận. */
  onPickAnother: () => void;
  busy?: boolean;
}

/**
 * 1.3 — File không mang dấu FlintFlow: hỏi đây có phải bản mới nhất không, vì từ giờ tài liệu này là nguồn sự
 * thật; sửa về sau phải qua change request (BR-03).
 */
export default function ConfirmLatestModal({ open, fileName, onConfirm, onPickAnother, busy = false }: ConfirmLatestModalProps) {
  const t = useTranslations("mode1.confirmLatest");
  return (
    <Modal open={open} onClose={onPickAnother} title={t("title")}>
      <div className="flex flex-col gap-4 text-body text-[#4B4842] leading-relaxed">
        <p>
          {t.rich("body", {
            file: () => <strong className="text-[#191817]">{fileName}</strong>,
            strong: (c) => <strong>{c}</strong>,
          })}
        </p>
        <p className="text-body text-[#8A867E]">{t("hint")}</p>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onPickAnother}
            disabled={busy}
            className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-body font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50"
          >
            {t("pickAnother")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-[8px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy ? t("parsing") : t("confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
