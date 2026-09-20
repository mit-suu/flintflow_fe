"use client";

import { useRef } from "react";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  label: string;
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
  /** id gốc để nối tab ↔ panel (`${idBase}-tab-${value}` / `${idBase}-panel`). */
  idBase: string;
  className?: string;
}

/**
 * Tab dạng segmented (role="tablist"): roving tabindex, mũi tên trái/phải + Home/End chuyển tab. Panel tương ứng
 * đặt `role="tabpanel"` + `id={`${idBase}-panel`}` + `aria-labelledby` = id tab đang chọn.
 */
export default function Tabs<T extends string>({ label, value, options, onChange, idBase, className }: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    const target = options[next].value;
    onChange(target);
    refs.current.get(target)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`inline-flex items-center gap-1 p-1 rounded-control bg-surface-container-high ${className ?? ""}`}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-inner text-[12.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selected ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(25,24,23,0.10)]" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`text-[11px] tabular-nums ${selected ? "text-on-surface-muted" : "text-on-surface-subtle"}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
