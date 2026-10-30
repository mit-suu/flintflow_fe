"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { ErdNotation } from "@/types/project";

const NOTATIONS: readonly ErdNotation[] = ["chen", "crowsfoot", "idef1x"];

interface ErdNotationPickerProps {
  value: ErdNotation;
  onChange: (notation: ErdNotation) => void;
  disabled?: boolean;
}

/**
 * Chọn ký pháp ERD của dự án (FLF-324): radiogroup dọc, mỗi lựa chọn có mô tả ngắn ký hiệu. Cùng cách bấm phím với
 * `DocumentLanguagePicker`: roving tabindex, mũi tên đổi lựa chọn, Space/Enter chọn. Nền phẳng, không viền.
 */
export default function ErdNotationPicker({ value, onChange, disabled = false }: ErdNotationPickerProps) {
  const t = useTranslations("app.projectDialogs.erdNotation");
  const refs = useRef(new Map<ErdNotation, HTMLDivElement>());

  const select = (notation: ErdNotation) => {
    if (!disabled) onChange(notation);
  };

  const onKeyDown = (e: React.KeyboardEvent, notation: ErdNotation) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = NOTATIONS[(NOTATIONS.indexOf(notation) + step + NOTATIONS.length) % NOTATIONS.length];
      select(next);
      refs.current.get(next)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(notation);
    }
  };

  return (
    <div role="radiogroup" aria-label={t("label")} aria-disabled={disabled || undefined} className="flex flex-col gap-2">
      {NOTATIONS.map((notation) => {
        const checked = value === notation;
        return (
          <div
            key={notation}
            ref={(node) => {
              if (node) refs.current.set(notation, node);
              else refs.current.delete(notation);
            }}
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={!disabled && checked ? 0 : -1}
            onClick={() => select(notation)}
            onKeyDown={(e) => onKeyDown(e, notation)}
            className={`flex flex-col gap-0.5 px-4 py-3 rounded-control outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${checked ? "bg-primary-soft" : "bg-surface-container hover:bg-surface-container-high"}`}
          >
            <span className="text-body font-semibold text-on-surface">{t(notation)}</span>
            <span className="text-body text-on-surface-variant leading-[1.55]">{t(`${notation}Detail`)}</span>
          </div>
        );
      })}
    </div>
  );
}
