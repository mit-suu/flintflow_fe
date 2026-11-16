"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { SequenceLevel } from "@/types/project";

const LEVELS: readonly SequenceLevel[] = ["system", "component"];

interface SequenceLevelPickerProps {
  value: SequenceLevel;
  onChange: (level: SequenceLevel) => void;
  disabled?: boolean;
}

/**
 * Chọn mức vẽ Sequence Diagram của dự án (FLF-418), cùng cách làm với `ErdNotationPicker`: radiogroup dọc, mỗi lựa chọn có
 * mô tả ngắn; roving tabindex, mũi tên đổi lựa chọn, Space/Enter chọn.
 */
export default function SequenceLevelPicker({ value, onChange, disabled = false }: SequenceLevelPickerProps) {
  const t = useTranslations("app.projectDialogs.sequenceLevel");
  const refs = useRef(new Map<SequenceLevel, HTMLDivElement>());

  const select = (level: SequenceLevel) => {
    if (!disabled) onChange(level);
  };

  const onKeyDown = (e: React.KeyboardEvent, level: SequenceLevel) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = LEVELS[(LEVELS.indexOf(level) + step + LEVELS.length) % LEVELS.length];
      select(next);
      refs.current.get(next)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(level);
    }
  };

  return (
    <div role="radiogroup" aria-label={t("label")} aria-disabled={disabled || undefined} className="flex flex-col gap-2">
      {LEVELS.map((level) => {
        const checked = value === level;
        return (
          <div
            key={level}
            ref={(node) => {
              if (node) refs.current.set(level, node);
              else refs.current.delete(level);
            }}
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={!disabled && checked ? 0 : -1}
            onClick={() => select(level)}
            onKeyDown={(e) => onKeyDown(e, level)}
            className={`flex flex-col gap-0.5 px-4 py-3 rounded-control outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${checked ? "bg-primary-soft" : "bg-surface-container hover:bg-surface-container-high"}`}
          >
            <span className="text-body font-semibold text-on-surface">{t(level)}</span>
            <span className="text-body text-on-surface-variant leading-[1.55]">{t(`${level}Detail`)}</span>
          </div>
        );
      })}
    </div>
  );
}
