"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { DocumentLanguage } from "@/types/project";

const LANGUAGES: readonly DocumentLanguage[] = ["vi", "en"];

interface DocumentLanguagePickerProps {
  value: DocumentLanguage;
  onChange: (language: DocumentLanguage) => void;
  disabled?: boolean;
  /** `id` của nhãn bên ngoài; không truyền ⇒ nhóm tự gắn `aria-label`. */
  labelledBy?: string;
}

/**
 * Chọn ngôn ngữ tài liệu (FLF-265): radiogroup 2 nút liền nhau (vi / en). Cùng cách bấm phím với `SourceModePicker`:
 * roving tabindex, mũi tên đổi lựa chọn, Space/Enter chọn. Dùng chung cho form tạo dự án và hộp đổi ngôn ngữ.
 */
export default function DocumentLanguagePicker({ value, onChange, disabled = false, labelledBy }: DocumentLanguagePickerProps) {
  const t = useTranslations("app.createProject.language");
  const refs = useRef(new Map<DocumentLanguage, HTMLDivElement>());

  const select = (language: DocumentLanguage) => {
    if (!disabled) onChange(language);
  };

  const onKeyDown = (e: React.KeyboardEvent, language: DocumentLanguage) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = LANGUAGES[(LANGUAGES.indexOf(language) + step + LANGUAGES.length) % LANGUAGES.length];
      select(next);
      refs.current.get(next)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(language);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t("label")}
      aria-disabled={disabled || undefined}
      // Nền xám như ô tên dự án; nút đang chọn nổi nền trắng — không viền
      className="inline-flex self-start gap-1 p-1 rounded-control bg-surface-container"
    >
      {LANGUAGES.map((language) => {
        const checked = value === language;
        return (
          <div
            key={language}
            ref={(node) => {
              if (node) refs.current.set(language, node);
              else refs.current.delete(language);
            }}
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={!disabled && checked ? 0 : -1}
            onClick={() => select(language)}
            onKeyDown={(e) => onKeyDown(e, language)}
            className={`px-3.5 h-8 flex items-center rounded-[8px] text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${checked ? "bg-surface-container-lowest text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            {t(language)}
          </div>
        );
      })}
    </div>
  );
}
