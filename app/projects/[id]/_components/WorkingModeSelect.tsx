"use client";

import type { WorkingMode } from "@/types/spine";

interface WorkingModeSelectProps {
  value: WorkingMode | null;
  onChange: (mode: WorkingMode) => void;
  disabled?: boolean;
}

const OPTIONS: { value: WorkingMode; label: string; hint: string }[] = [
  { value: "fast", label: "Nhanh", hint: "Gom câu hỏi, duyệt một lần cuối phase" },
  { value: "coaching", label: "Kèm cặp", hint: "Hỏi kỹ từng bước, duyệt từng bước" },
];

/** B-0.4 Working Mode; đổi ở ranh giới phase qua menu [C]. */
export default function WorkingModeSelect({ value, onChange, disabled = false }: WorkingModeSelectProps) {
  return (
    <div role="radiogroup" aria-label="Cách làm việc" className="flex items-center gap-0.5 bg-surface-container-high rounded-control p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          title={option.hint}
          onClick={() => value !== option.value && onChange(option.value)}
          className={`flex-1 h-7 px-3 rounded-inner text-[12px] font-bold text-center transition-colors ${
            value === option.value ? "bg-surface-container-lowest text-on-surface" : "text-on-surface-variant hover:text-on-surface"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
