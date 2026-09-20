"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { SOURCE_MODE_OPTIONS, type SourceModeTone } from "@/lib/project-source-mode";
import type { ProjectMode } from "@/types/project";

// Màu theo tone của mode — chỉ token. Thẻ phẳng không viền (cùng ngôn ngữ với card dự án): chọn ⇒ nền ngả màu tone
const TONE: Record<SourceModeTone, { icon: string; selected: string }> = {
  info: { icon: "text-info", selected: "bg-info-soft" },
  warning: { icon: "text-accent-gold-text", selected: "bg-accent-gold-soft" },
  primary: { icon: "text-primary", selected: "bg-surface-card" },
};

interface SourceModePickerProps {
  value: ProjectMode | null;
  onChange: (mode: ProjectMode) => void;
  disabled?: boolean;
}

/**
 * Chọn nguồn khởi đầu (UC-13): radiogroup 3 thẻ. Không chọn sẵn mode nào. Thẻ `status: "soon"` hiện nhưng
 * không chọn được (chuột lẫn phím), mũi tên bỏ qua nó.
 */
export default function SourceModePicker({ value, onChange, disabled = false }: SourceModePickerProps) {
  const t = useTranslations("app.sourceMode");
  const refs = useRef(new Map<ProjectMode, HTMLDivElement>());
  const ready: ProjectMode[] = SOURCE_MODE_OPTIONS.filter((o) => o.status === "ready").map((o) => o.value);
  // Roving tabindex: Tab vào nhóm rơi đúng thẻ đang chọn (chưa chọn ⇒ thẻ sẵn sàng đầu tiên)
  const tabStop = value ?? ready[0];

  const select = (mode: ProjectMode) => {
    if (disabled || !ready.includes(mode)) return;
    onChange(mode);
  };

  const onKeyDown = (e: React.KeyboardEvent, mode: ProjectMode) => {
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
    <div role="radiogroup" aria-label={t("groupLabel")} className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            // Phẳng, không viền, không bóng: phân biệt bằng nền — thường xám ấm, hover đậm một nấc, chọn ⇒ nền màu tone
            className={`relative flex flex-col gap-2.5 p-4 rounded-card text-left transition-colors duration-200 outline-none ${
              soon
                ? "bg-surface-container-low cursor-not-allowed"
                : `cursor-pointer focus-visible:ring-2 focus-visible:ring-primary ${
                    checked ? tone.selected : "bg-surface-container hover:bg-surface-container-high"
                  }`
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Chip trắng nổi trên nền thẻ; thẻ "Sắp có" nhạt hẳn để mắt bỏ qua */}
              <span
                className={`w-9 h-9 rounded-control flex items-center justify-center bg-surface-container-lowest ${
                  soon ? "text-on-surface-subtle" : tone.icon
                }`}
              >
                <Icon name={option.icon} size={18} />
              </span>
              {soon ? (
                <Badge tone="soon" />
              ) : (
                // Chỉ hiện dấu chọn khi đã chọn — không vẽ vòng tròn rỗng (lại thành một đường viền)
                checked && (
                  <span aria-hidden className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <Icon name="check" size={12} />
                  </span>
                )
              )}
            </div>
            <span className={`text-[13.5px] font-bold ${soon ? "text-on-surface-muted" : "text-on-surface"}`}>{t(`${option.key}.label`)}</span>
            <span className={`text-[12px] leading-[1.5] ${soon ? "text-on-surface-subtle" : "text-on-surface-variant"}`}>
              {t(`${option.key}.description`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
