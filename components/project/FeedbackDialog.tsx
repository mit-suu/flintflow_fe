"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { FEEDBACK_MESSAGE_MAX, submitFeedback, type FeedbackCategory } from "@/lib/api/feedback";

const CATEGORIES: readonly { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Báo lỗi" },
  { value: "suggestion", label: "Đề xuất" },
  { value: "other", label: "Khác" },
];

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

/** UC-12: member gửi góp ý (`POST /feedback`); admin đọc ở `/admin/feedback`. */
export default function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose();
    // Mở lại là form mới
    setSent(false);
    setMessage("");
    setError(null);
    setCategory("suggestion");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({ category, message: trimmed });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được góp ý, thử lại sau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Gửi góp ý">
      {sent ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-[13.5px] text-on-surface-medium leading-[1.6]">
            Cảm ơn bạn! Góp ý đã được gửi tới đội FlintFlow.
          </p>
          <div className="flex justify-end">
            <Button onClick={close}>Đóng</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12.5px] font-bold text-on-surface-medium mb-2">Loại góp ý</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`px-3.5 h-8 inline-flex items-center rounded-full border text-[12.5px] font-semibold cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                    category === c.value
                      ? "bg-primary-soft border-outline-purple text-primary-hover"
                      : "bg-surface-container-lowest border-outline text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="feedback-category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-message" className="text-[12.5px] font-bold text-on-surface-medium">
              Nội dung
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={FEEDBACK_MESSAGE_MAX}
              rows={5}
              placeholder="Bạn gặp vấn đề gì hoặc muốn FlintFlow có thêm gì?"
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-outline bg-surface-container-low text-[13px] text-on-surface outline-none resize-y focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <span className="self-end text-[11px] text-on-surface-subtle tabular-nums">
              {message.length}/{FEEDBACK_MESSAGE_MAX}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-[10px] px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" loading={submitting} disabled={!message.trim()}>
              Gửi góp ý
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
