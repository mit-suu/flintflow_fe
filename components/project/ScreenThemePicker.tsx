"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import Icon from "@/components/ui/Icon";
import type { ScreenPlatform, ScreenTheme } from "@/types/project";

/** Màu mặc định của mockup khi dự án chưa chọn (trùng `DEFAULT_PRIMARY_COLOR` của BE). */
export const DEFAULT_PRIMARY_COLOR = "#3F5591";
export const SWATCHES = ["#3F5591", "#1565C0", "#00897B", "#2E7D5B", "#E4572E", "#C62828", "#7B1FA2", "#FFD400"] as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const PLATFORMS: readonly ScreenPlatform[] = ["web", "mobile"];

/** Chữ trên nền màu chính: trắng nếu tương phản ≥ 3:1 (chữ đậm cỡ lớn, như renderer BE), không thì đen. */
export const textOn = (hex: string): string => {
  const lum = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => lum(parseInt(hex.slice(i, i + 2), 16)));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05) >= 3 ? "#FFFFFF" : "#000000";
};

export const isHexColor = (value: string) => HEX.test(value);

interface ScreenThemePickerProps {
  value: ScreenTheme;
  onChange: (theme: ScreenTheme) => void;
  /** Ô hex đang gõ dở (chưa hợp lệ) — giữ ở chủ để nút Lưu biết còn lỗi. */
  hexDraft: string;
  onHexDraftChange: (draft: string) => void;
  disabled?: boolean;
}

/**
 * Theme mockup màn (FLF-410): màu chính (8 màu gợi ý + ô hex, xem trước header + nút), domain trên thanh địa chỉ, nền tảng vẽ.
 * Markup phẳng, không viền; ô nhập theo kiểu ô nhập của hộp đổi tên.
 */
export default function ScreenThemePicker({ value, onChange, hexDraft, onHexDraftChange, disabled = false }: ScreenThemePickerProps) {
  const t = useTranslations("app.projectDialogs.screenTheme");
  const ids = { color: useId(), domain: useId() };
  const color = value.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const shown = isHexColor(hexDraft) ? hexDraft.toUpperCase() : color;
  const auto = value.platforms === null;

  const pickColor = (hex: string) => {
    onHexDraftChange(hex);
    onChange({ ...value, primaryColor: hex });
  };
  const togglePlatform = (p: ScreenPlatform) => {
    const current = value.platforms ?? [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : PLATFORMS.filter((x) => x === p || current.includes(x));
    onChange({ ...value, platforms: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="text-body font-bold text-on-surface-medium mb-2">{t("colorLabel")}</legend>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("colorLabel")}>
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={shown === hex}
              aria-label={hex}
              title={hex}
              onClick={() => pickColor(hex)}
              className={`size-8 rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform ${
                shown === hex ? "ring-2 ring-offset-2 ring-on-surface scale-105" : "hover:scale-105"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <label htmlFor={ids.color} className="sr-only">
            {t("hexLabel")}
          </label>
          <input
            id={ids.color}
            type="text"
            value={hexDraft}
            maxLength={7}
            placeholder="#3F5591"
            aria-invalid={hexDraft !== "" && !isHexColor(hexDraft)}
            onChange={(e) => {
              const draft = e.target.value.trim();
              onHexDraftChange(draft);
              if (isHexColor(draft)) onChange({ ...value, primaryColor: draft.toUpperCase() });
            }}
            className="h-9 w-28 px-3 rounded-control bg-surface-container-low text-body font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary/15 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-error/40"
          />
        </div>
        {hexDraft !== "" && !isHexColor(hexDraft) && <p className="text-caption text-error">{t("hexInvalid")}</p>}
        {value.primaryColor === null && <p className="text-caption text-on-surface-variant">{t("colorDefault")}</p>}
        {/* Xem trước nhỏ: header + nút chính / nút viền đổi màu ngay */}
        <div aria-hidden className="rounded-control overflow-hidden bg-surface-container-low">
          <div className="h-9 px-3 flex items-center text-body font-bold" style={{ backgroundColor: shown, color: textOn(shown) }}>
            {t("previewBrand")}
          </div>
          <div className="px-3 py-3 flex gap-2">
            <span className="h-8 px-3 inline-flex items-center rounded-[4px] text-caption font-bold" style={{ backgroundColor: shown, color: textOn(shown) }}>
              {t("previewPrimary")}
            </span>
            <span className="h-8 px-3 inline-flex items-center rounded-[4px] text-caption bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${shown}`, color: shown }}>
              {t("previewSecondary")}
            </span>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.domain} className="text-body font-bold text-on-surface-medium">
          {t("domainLabel")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={ids.domain}
            type="text"
            value={value.domain ?? ""}
            maxLength={253}
            disabled={disabled}
            placeholder={t("domainPlaceholder")}
            onChange={(e) => onChange({ ...value, domain: e.target.value.trim() === "" ? null : e.target.value })}
            className="h-10 flex-1 min-w-0 px-3.5 rounded-control bg-surface-container-low text-body text-on-surface outline-none focus:ring-2 focus:ring-primary/15"
          />
          {value.domain && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, domain: null })}
              aria-label={t("domainClear")}
              title={t("domainClear")}
              className="size-9 inline-flex items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <p className="text-caption text-on-surface-variant">{t("domainNote")}</p>
      </div>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="text-body font-bold text-on-surface-medium mb-2">{t("platformLabel")}</legend>
        <label className="flex items-center gap-2 text-body text-on-surface cursor-pointer">
          <input type="checkbox" checked={auto} onChange={() => onChange({ ...value, platforms: auto ? ["web"] : null })} className="size-4 accent-primary" />
          {t("platformAuto")}
        </label>
        <div className="flex gap-4 pl-6">
          {PLATFORMS.map((p) => {
            const checked = auto ? false : (value.platforms ?? []).includes(p);
            // Ít nhất một nền tảng: không cho bỏ ô cuối cùng
            const last = checked && (value.platforms ?? []).length === 1;
            return (
              <label key={p} className={`flex items-center gap-2 text-body ${auto ? "text-on-surface-variant" : "text-on-surface"} cursor-pointer`}>
                <input type="checkbox" checked={checked} disabled={auto || last} onChange={() => togglePlatform(p)} className="size-4 accent-primary" />
                {t(`platform.${p}`)}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
