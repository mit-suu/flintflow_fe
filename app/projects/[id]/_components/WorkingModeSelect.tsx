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
    <div role="radiogroup" aria-label="Cách làm việc" className="flex items-center gap-1 bg-[#F5F3F0] rounded-full p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          title={option.hint}
          onClick={() => value !== option.value && onChange(option.value)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
            value === option.value ? "bg-white text-[#191817] shadow-2xs" : "text-[#6B6862] hover:text-[#191817]"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
