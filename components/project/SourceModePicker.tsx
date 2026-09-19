"use client";

import { useRef } from "react";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { SOURCE_MODE_OPTIONS, type SourceModeTone } from "@/lib/project-source-mode";
import type { ProjectSourceMode } from "@/types/project";

// Màu theo tone của mode — chỉ token
const TONE: Record<SourceModeTone, { icon: string; selected: string }> = {
  info: { icon: "bg-info-soft text-info", selected: "border-info ring-info/20" },
  warning: { icon: "bg-accent-gold-soft text-accent-gold-text", selected: "border-accent-gold ring-accent-gold/20" },
  primary: { icon: "bg-primary-soft text-primary", selected: "border-primary ring-primary/20" },
};

interface SourceModePickerProps {
  value: ProjectSourceMode | null;
  onChange: (mode: ProjectSourceMode) => void;
  disabled?: boolean;
}

/**
 * Chọn nguồn khởi đầu (UC-13): radiogroup 3 thẻ. Không chọn sẵn mode nào. Thẻ `status: "soon"` hiện nhưng
 * không chọn được (chuột lẫn phím), mũi tên bỏ qua nó.
 */
export default function SourceModePicker({ value, onChange, disabled = false }: SourceModePickerProps) {
  const refs = useRef(new Map<ProjectSourceMode, HTMLDivElement>());
  const ready: ProjectSourceMode[] = SOURCE_MODE_OPTIONS.filter((o) => o.status === "ready").map((o) => o.value);
  // Roving tabindex: Tab vào nhóm rơi đúng thẻ đang chọn (chưa chọn ⇒ thẻ sẵn sàng đầu tiên)
  const tabStop = value ?? ready[0];

  const select = (mode: ProjectSourceMode) => {
    if (disabled || !ready.includes(mode)) return;
    onChange(mode);
  };

  const onKeyDown = (e: React.KeyboardEvent, mode: ProjectSourceMode) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = ready[(ready.indexOf(mode) + step + ready.length) % ready.length];
      select(next);
      refs.current.get(next)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(mode);
    }
  };

  return (
    <div role="radiogroup" aria-label="Bạn bắt đầu từ đâu?" className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {SOURCE_MODE_OPTIONS.map((option) => {
        const soon = option.status === "soon";
        const checked = value === option.value;
        const tone = TONE[option.tone];
        return (
          <div
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            role="radio"
            aria-checked={checked}
            aria-disabled={soon || disabled || undefined}
            tabIndex={!soon && !disabled && option.value === tabStop ? 0 : -1}
            onClick={() => select(option.value)}
            onKeyDown={(e) => onKeyDown(e, option.value)}
            className={`relative flex flex-col gap-2.5 p-4 rounded-[16px] border bg-surface-container-lowest text-left transition-all outline-none ${
              soon
                ? "border-outline-variant opacity-70 cursor-not-allowed"
                : `cursor-pointer hover:shadow-[0_10px_26px_rgba(25,24,23,0.07)] focus-visible:ring-4 focus-visible:ring-primary/20 ${
                    checked ? `ring-4 ${tone.selected}` : "border-outline hover:border-outline-purple"
                  }`
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`w-9 h-9 rounded-[11px] flex items-center justify-center ${tone.icon}`}>
                <Icon name={option.icon} size={18} />
              </span>
              {soon ? (
                <Badge tone="soon" />
              ) : (
                <span
                  aria-hidden
                  className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                    checked ? "border-primary bg-primary text-on-primary" : "border-outline"
                  }`}
                >
                  {checked && <Icon name="check" size={11} />}
                </span>
              )}
            </div>
            <span className="text-[13.5px] font-extrabold text-on-surface">{option.label}</span>
            <span className="text-[12px] leading-[1.5] text-on-surface-muted">{option.description}</span>
          </div>
        );
      })}
    </div>
  );
}
