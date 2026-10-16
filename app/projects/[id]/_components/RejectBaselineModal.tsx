"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { SrsComment } from "@/types/comment";

const REASON_MAX = 2000;

interface RejectBaselineModalProps {
  open: boolean;
  onClose: () => void;
  /** Góp ý đang mở của dự án — Lead chọn trong đây để gắn vào lượt từ chối. */
  openComments: SrsComment[];
  busy: boolean;
  /** `commentIds` luôn có ít nhất một phần tử (nút gửi tắt khi chưa chọn). */
  onReject: (reason: string, commentIds: readonly [string, ...string[]]) => Promise<void>;
  /** Mở panel Góp ý để Lead đi ghim trước, khi chưa có góp ý nào. */
  onOpenComments: () => void;
}

/**
 * Từ chối baseline (UC-46 luồng thay thế).
 *
 * `business-flow.md §3.5` đòi **"bắt buộc lý do + comment ghim"**, và BE chặn bằng `comment_ids ≥ 1`.
 * Lý do suông thì Analyst không biết sửa chỗ nào và không bước nào được mở lại — nên modal này bắt
 * chọn ít nhất một góp ý, và khi chưa có góp ý nào thì chỉ đường đi ghim thay vì hiện form cụt.
 */
export default function RejectBaselineModal({ open, onClose, openComments, busy, onReject, onOpenComments }: RejectBaselineModalProps) {
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const trimmed = reason.trim();
  const canSend = trimmed.length > 0 && picked.length > 0;

  const toggle = (commentId: string) =>
    setPicked((prev) => (prev.includes(commentId) ? prev.filter((id) => id !== commentId) : [...prev, commentId]));

  const send = async () => {
    if (!canSend) return;
    await onReject(trimmed, picked as [string, ...string[]]);
    setReason("");
    setPicked([]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Từ chối baseline" size="lg">
      {openComments.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-on-surface">
            Từ chối phải kèm góp ý ghim vào đúng chỗ cần sửa — Analyst mới biết sửa gì, và bước đã duyệt của mục đó mới
            mở lại được.
          </p>
          <p className="text-body text-on-surface-variant">
            Bấm <span className="font-bold text-on-surface">“Góp ý”</span> trên mục cần sửa trong tài liệu, rồi quay lại
            đây.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Để sau
            </Button>
            <Button onClick={onOpenComments}>Mở Góp ý</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reject-reason" className="text-caption font-bold text-on-surface-variant">
              Lý do từ chối
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={3}
              placeholder="Vì sao bản này chưa chốt được?"
              className="w-full bg-surface-container-low rounded-inner px-3 py-2 text-body text-on-surface placeholder:text-on-surface-subtle resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption font-bold text-on-surface-variant pb-1.5">
              Góp ý gửi kèm ({picked.length}/{openComments.length})
            </legend>
            <div className="max-h-64 overflow-y-auto ff-scroll flex flex-col gap-1.5">
              {openComments.map((comment) => (
                <label
                  key={comment.comment_id}
                  className="flex items-start gap-2.5 bg-surface-container-low rounded-inner p-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(comment.comment_id)}
                    onChange={() => toggle(comment.comment_id)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-caption font-bold text-primary truncate">{comment.anchor.label}</span>
                    <span className="text-body text-on-surface line-clamp-2">{comment.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-caption text-on-surface-variant">
            Khi Analyst xử lý một góp ý, bước đã duyệt sở hữu mục đó sẽ mở lại để soạn theo góp ý.
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Huỷ
            </Button>
            <Button variant="danger" loading={busy} disabled={!canSend} onClick={() => void send()}>
              Từ chối
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
