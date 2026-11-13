"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { TextSection } from "@/types/import";

/** ⓘ: hover hoặc focus bằng bàn phím đều hiện giải thích (cùng kiểu ô "Bổ sung…" ở hộp Tạo dự án). */
function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  return (
    <span className="relative group inline-flex">
      <button type="button" aria-label={label} aria-describedby={id} className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-muted hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary/40 outline-none cursor-help">
        <Icon name="info" size={15} />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full z-50 mb-2 w-[300px] rounded-control bg-inverse-surface px-3 py-2 text-caption font-normal leading-relaxed text-inverse-on-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

interface TextSectionsProps {
  sections: TextSection[];
  busy?: boolean;
  /** Cả tập khoá vùng chọn Bỏ chữ sau lần bấm. */
  onChange: (droppedKeys: string[]) => void;
}

/**
 * FLF-412 — màn đọc khung: mục có chữ của file chọn **Giữ nội dung / Bỏ chữ**. File thường là mẫu lấy từ dự án khác mà chưa xoá
 * chữ cũ; Code không phân biệt được nên người dùng chọn. Mục bỏ chữ chỉ còn khung, FlintFlow soạn lại. BE tính lại bản sơ bộ và
 * credit sau mỗi lần đổi (chưa tốn credit tới khi bấm Bắt đầu).
 */
export default function TextSections({ sections, busy = false, onChange }: TextSectionsProps) {
  const t = useTranslations("workspace.import.preview.drop");
  if (!sections.length) return null;
  const dropped = sections.filter((s) => s.dropped).map((s) => s.key);
  const allDropped = dropped.length === sections.length;
  const toggle = (key: string, drop: boolean) => onChange(drop ? [...dropped, key] : dropped.filter((k) => k !== key));

  return (
    <section aria-labelledby="text-sections-title" className="flex flex-col gap-3 rounded-card bg-surface-container p-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px] flex flex-col gap-1">
          <h3 id="text-sections-title" className="text-body font-bold text-on-surface">
            {t("title")}
          </h3>
          <p className="text-caption text-on-surface-variant leading-relaxed">{t("hint")}</p>
        </div>
        <span className="inline-flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={allDropped ? "refresh" : "trash"} disabled={busy} onClick={() => onChange(allDropped ? [] : sections.map((s) => s.key))}>
            {allDropped ? t("keepAll") : t("dropAll")}
          </Button>
          <InfoTip label={t("dropAllInfoLabel")} text={allDropped ? t("keepAllInfo") : t("dropAllInfo")} />
        </span>
      </header>

      <div className="flex items-center justify-end gap-1 text-caption font-semibold text-on-surface-muted">
        <span>{t("keep")}</span>
        <InfoTip label={t("keepInfoLabel")} text={t("keepInfo")} />
        <span className="ml-2">{t("drop")}</span>
        <InfoTip label={t("dropInfoLabel")} text={t("dropInfo")} />
      </div>

      <ul className="flex flex-col gap-1">
        {sections.map((s) => (
          <li key={s.key} className="flex items-center gap-3 rounded-control bg-surface-container-lowest px-3 py-2">
            <span className="flex-1 min-w-0 truncate text-body text-on-surface" style={{ paddingLeft: `${Math.max(0, s.level - 1) * 12}px` }} title={s.title}>
              {s.title}
            </span>
            <span role="group" aria-label={t("choiceLabel", { title: s.title })} className="inline-flex shrink-0 rounded-control bg-surface-container p-0.5">
              {([false, true] as const).map((drop) => {
                const active = s.dropped === drop;
                return (
                  <button
                    key={String(drop)}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => !active && toggle(s.key, drop)}
                    className={`h-7 rounded-inner px-3 text-caption font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      active ? (drop ? "bg-accent-gold-soft text-accent-gold-text" : "bg-primary-soft text-primary") : "text-on-surface-muted hover:text-on-surface"
                    }`}
                  >
                    {drop ? t("drop") : t("keep")}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
