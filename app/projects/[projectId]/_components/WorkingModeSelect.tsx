"use client";

import { useTranslations } from "next-intl";
import type { WorkingMode } from "@/types/spine";

interface WorkingModeSelectProps {
  value: WorkingMode | null;
  onChange: (mode: WorkingMode) => void;
  disabled?: boolean;
}

/** Nhãn và gợi ý ở `app.workingMode.<value>`. */
const OPTIONS: WorkingMode[] = ["fast", "coaching"];

/** B-0.4 Working Mode; đổi ở ranh giới phase qua menu [C]. */
export default function WorkingModeSelect({ value, onChange, disabled = false }: WorkingModeSelectProps) {
  const t = useTranslations("app.workingMode");

  return (
    <div role="radiogroup" aria-label={t("aria")} className="flex items-center gap-1 bg-[#F5F3F0] rounded-full p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          title={t(`${option}.hint`)}
          onClick={() => value !== option && onChange(option)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
            value === option ? "bg-white text-[#191817] shadow-2xs" : "text-[#6B6862] hover:text-[#191817]"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {t(`${option}.label`)}
        </button>
      ))}
    </div>
  );
}
