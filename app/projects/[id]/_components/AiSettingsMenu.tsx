"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { ReviewMode, WorkingMode } from "@/types/spine";
import WorkingModeSelect from "./WorkingModeSelect";
import ReviewModeSelect, { REVIEW_OPTIONS } from "./ReviewModeSelect";

interface AiSettingsMenuProps {
  workingMode: WorkingMode | null;
  onChangeWorkingMode: (mode: WorkingMode) => void;
  reviewMode: ReviewMode;
  onChangeReviewMode: (mode: ReviewMode) => void;
  disabled?: boolean;
}

const WORKING_HINT: Record<WorkingMode, string> = {
  fast: "Gom câu hỏi, duyệt một lần cuối giai đoạn.",
  coaching: "Hỏi kỹ từng bước, duyệt từng bước.",
};

/**
 * "AI làm việc với bạn thế nào" — cách làm việc + lúc nào dừng chờ duyệt, đặt ngay ô chat (như nút chọn model ở
 * các app chat) thay vì đáy rail tiến độ. Chip hiện cách làm việc đang chọn; bấm mở ô nổi lên trên.
 */
export default function AiSettingsMenu({ workingMode, onChangeWorkingMode, reviewMode, onChangeReviewMode, disabled = false }: AiSettingsMenuProps) {
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

  const workingLabel = workingMode === "fast" ? "Nhanh" : "Kèm cặp";
  const review = REVIEW_OPTIONS.find((o) => o.value === reviewMode) ?? REVIEW_OPTIONS[1];

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
        {workingLabel}
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
            <span className="text-[11.5px] font-bold text-on-surface">Cách làm việc</span>
            <WorkingModeSelect value={workingMode} onChange={onChangeWorkingMode} disabled={disabled} />
            {workingMode && <p className="text-[11px] text-on-surface-muted">{WORKING_HINT[workingMode]}</p>}
          </div>
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
