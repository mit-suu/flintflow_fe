"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { ReviewMode } from "@/types/spine";
import ReviewModeSelect, { displayReviewMode } from "./ReviewModeSelect";

interface AiSettingsMenuProps {
  reviewMode: ReviewMode;
  onChangeReviewMode: (mode: ReviewMode) => void;
  disabled?: boolean;
  /** FLF-337: phần đã bấm "Chấp nhận, không hỏi lại" — hiện để bật lại. */
  skipSections?: { id: string; title: string }[];
  onRestoreSection?: (sectionId: string) => void;
}

/**
 * "AI dừng chờ duyệt ở đâu" — đặt ngay ô chat (như nút chọn model ở các app chat) thay vì đáy rail tiến độ.
 * Chip hiện chế độ duyệt đang chọn; bấm mở ô nổi lên trên. AI tự quyết hỏi nhiều hay ít (FLF-220).
 */
export default function AiSettingsMenu({ reviewMode, onChangeReviewMode, disabled = false, skipSections = [], onRestoreSection }: AiSettingsMenuProps) {
  const t = useTranslations("workspace.aiSettings");
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

  const review = displayReviewMode(reviewMode);
  const reviewLabel = t(`modes.${review}`);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("aria", { mode: reviewLabel })}
        title={t("title")}
        // Thanh công cụ rất hẹp ⇒ bỏ nhãn chế độ, giữ icon + mũi tên để vẫn thấy đây là menu
        className={`h-8 pl-2 pr-1.5 shrink-0 rounded-control flex items-center gap-1 whitespace-nowrap text-body font-bold transition-colors cursor-pointer ${
          open ? "bg-surface-container-high text-on-surface" : "text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface"
        }`}
      >
        <Icon name="sparkle" size={14} />
        <span className="@max-[256px]:hidden">{reviewLabel}</span>
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("title")}
          className="absolute bottom-full left-0 mb-2 z-40 w-[300px] bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-3 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-body font-bold text-on-surface">{t("heading")}</span>
            <ReviewModeSelect value={reviewMode} onChange={onChangeReviewMode} disabled={disabled} />
            <p className="text-caption text-on-surface-muted">{t(`hints.${review}`)}</p>
            <p className="text-caption text-on-surface-muted">{t("hardGates")}</p>
          </div>
          {skipSections.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-outline-variant pt-2">
              <span className="text-body font-bold text-on-surface">{t("skipSections.title")}</span>
              <p className="text-caption text-on-surface-muted">{t("skipSections.note")}</p>
              <ul className="flex flex-col gap-1" aria-label={t("skipSections.title")}>
                {skipSections.map((section) => (
                  <li key={section.id} className="flex items-center justify-between gap-2 text-body">
                    <span className="truncate">{section.title}</span>
                    {onRestoreSection && (
                      <button type="button" disabled={disabled} onClick={() => onRestoreSection(section.id)} className="text-caption font-bold underline cursor-pointer whitespace-nowrap disabled:opacity-50">
                        {t("skipSections.restore")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
