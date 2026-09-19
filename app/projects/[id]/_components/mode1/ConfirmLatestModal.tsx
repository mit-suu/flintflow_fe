"use client";

import Modal from "@/components/Modal";

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
  return (
    <Modal open={open} onClose={onPickAnother} title="Đây có phải bản mới nhất?">
      <div className="flex flex-col gap-4 text-[13px] text-[#4B4842] leading-relaxed">
        <p>
          <strong className="text-[#191817]">{fileName}</strong> không do FlintFlow xuất ra. Sau khi nhập, tài liệu này thành
          bản gốc <strong>0.0</strong> của dự án và mọi chỉnh sửa về sau phải đi qua change request.
        </p>
        <p className="text-[12px] text-[#8A867E]">Nếu còn bản mới hơn ở chỗ khác (email, ổ chung…), hãy chọn bản đó.</p>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onPickAnother}
            disabled={busy}
            className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50"
          >
            Chọn file khác
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-[8px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Đang tách block…" : "Đúng, đây là bản mới nhất"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
