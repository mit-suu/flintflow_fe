"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import Icon from "@/components/ui/Icon";
import { PROJECT_START_OPTIONS } from "@/lib/project-start";
import type { ProjectStartKind } from "@/types/project";

interface ProjectStartPickerProps {
  value: ProjectStartKind | null;
  onChange: (kind: ProjectStartKind) => void;
  /** Chỉ hỏi khi chọn "Dự án mới": khách có bắt buộc theo một mẫu không? `null` = chưa trả lời. */
  hasRequiredTemplate: boolean | null;
  onHasRequiredTemplateChange: (value: boolean) => void;
  disabled?: boolean;
}

const CARD = "relative flex flex-col gap-2.5 p-4 rounded-card text-left transition-colors duration-200 outline-none";

/**
 * Chọn cách bắt đầu (FLF-335, business-flow §1): hai thẻ **Dự án mới** / **Dự án có sẵn** — không còn thẻ chế độ. Chọn
 * "Dự án mới" hiện thêm câu hỏi có / không về mẫu bắt buộc (có ⇒ sang màn tải mẫu). "Dự án có sẵn" hỏi ý định lúc upload.
 */
export default function ProjectStartPicker({ value, onChange, hasRequiredTemplate, onHasRequiredTemplateChange, disabled = false }: ProjectStartPickerProps) {
  const t = useTranslations("app.projectStart");
  const refs = useRef(new Map<ProjectStartKind, HTMLDivElement>());
  const kinds = PROJECT_START_OPTIONS.map((o) => o.value);
  const tabStop = value ?? kinds[0];

  const select = (kind: ProjectStartKind) => {
    if (disabled) return;
    onChange(kind);
  };

  const onKeyDown = (e: React.KeyboardEvent, kind: ProjectStartKind) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = kinds[(kinds.indexOf(kind) + step + kinds.length) % kinds.length];
      select(next);
      refs.current.get(next)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(kind);
    }
  };

  const yesNo: { value: boolean; key: "yes" | "no" }[] = [
    { value: false, key: "no" },
    { value: true, key: "yes" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t("groupLabel")} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROJECT_START_OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <div
              key={option.value}
              ref={(node) => {
                if (node) refs.current.set(option.value, node);
                else refs.current.delete(option.value);
              }}
              role="radio"
              aria-checked={checked}
              aria-disabled={disabled || undefined}
              tabIndex={!disabled && option.value === tabStop ? 0 : -1}
              onClick={() => select(option.value)}
              onKeyDown={(e) => onKeyDown(e, option.value)}
              className={`${CARD} cursor-pointer focus-visible:ring-2 focus-visible:ring-primary ${checked ? "bg-surface-card" : "bg-surface-container hover:bg-surface-container-high"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="w-9 h-9 rounded-control flex items-center justify-center bg-surface-container-lowest text-primary">
                  <Icon name={option.icon} size={18} />
                </span>
                {checked && (
                  <span aria-hidden className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <Icon name="check" size={12} />
                  </span>
                )}
              </div>
              <span className="text-body font-bold text-on-surface">{t(`${option.key}.label`)}</span>
              <span className="text-body leading-[1.5] text-on-surface-variant">{t(`${option.key}.description`)}</span>
            </div>
          );
        })}
      </div>

      {value === "new" && (
        <div className="flex flex-col gap-2">
          <span id="required-template-label" className="text-body font-bold text-on-surface-medium">
            {t("requiredTemplate.question")}
          </span>
          <div role="radiogroup" aria-labelledby="required-template-label" className="flex flex-wrap gap-2">
            {yesNo.map((opt) => {
              const checked = hasRequiredTemplate === opt.value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() => onHasRequiredTemplateChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-body font-bold cursor-pointer transition-colors ${
                    checked ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  } disabled:opacity-50`}
                >
                  {t(`requiredTemplate.${opt.key}`)}
                </button>
              );
            })}
          </div>
          <p className="text-body text-on-surface-muted">{hasRequiredTemplate === null ? t("requiredTemplate.hint") : t(`requiredTemplate.${hasRequiredTemplate ? "yesHint" : "noHint"}`)}</p>
        </div>
      )}
      {value === "existing" && <p className="text-body text-on-surface-muted">{t("existing.hint")}</p>}
    </div>
  );
}
