"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { ReviewMode } from "@/types/spine";
import ReviewModeSelect, { REVIEW_OPTIONS, displayReviewMode } from "./ReviewModeSelect";

interface AiSettingsMenuProps {
  reviewMode: ReviewMode;
  onChangeReviewMode: (mode: ReviewMode) => void;
  disabled?: boolean;
}

/**
 * "AI dừng chờ duyệt ở đâu" — đặt ngay ô chat (như nút chọn model ở các app chat) thay vì đáy rail tiến độ.
 * Chip hiện chế độ duyệt đang chọn; bấm mở ô nổi lên trên. AI tự quyết hỏi nhiều hay ít (FLF-220).
 */
export default function AiSettingsMenu({ reviewMode, onChangeReviewMode, disabled = false }: AiSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Đóng khi bấm ra ngoài hoặc Esc
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const review = REVIEW_OPTIONS.find((o) => o.value === displayReviewMode(reviewMode)) ?? REVIEW_OPTIONS[1];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title="Cách AI làm việc với bạn"
        className={`h-8 pl-2 pr-1.5 rounded-control flex items-center gap-1 text-[12px] font-bold transition-colors cursor-pointer ${
          open ? "bg-surface-container-high text-on-surface" : "text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface"
        }`}
      >
        <Icon name="sparkle" size={14} />
        {review.label}
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Cách AI làm việc với bạn"
          className="absolute bottom-full left-0 mb-2 z-40 w-[300px] bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-3 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-on-surface">AI dừng chờ duyệt</span>
            <ReviewModeSelect value={reviewMode} onChange={onChangeReviewMode} disabled={disabled} />
            <p className="text-[11px] text-on-surface-muted">{review.hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
