"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchMe, updateExplanationStyle } from "@/lib/api/users";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { ExplanationStyle } from "@/types/user";
import ChatToolbarTip, { CHIP_ICON_ONLY_CLASS, CHIP_LABEL_CLASS } from "./ChatToolbarTip";

const NEXT: Record<ExplanationStyle, ExplanationStyle> = { concise: "explained", explained: "concise" };

/**
 * UC-90: switch nhỏ ở ô chat đổi nhanh cách AI trình bày phân tích (bật = Giải thích, tắt = Ngắn gọn) — cùng tuỳ chọn với thẻ ở Hồ sơ,
 * lưu theo tài khoản. Tự đọc `GET /users/me` khi mở workspace; chưa đọc xong thì chưa hiện. Đổi lạc quan, lỗi thì trả về
 * kiểu cũ và báo lỗi qua tooltip.
 */
export default function ExplanationStyleChip() {
  const t = useTranslations("workspace.explanationStyle");
  const [style, setStyle] = useState<ExplanationStyle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setStyle(me.explanationStyle ?? "explained");
      })
      // Không đọc được tài khoản ⇒ không hiện nút; tuỳ chọn vẫn đổi được ở Hồ sơ
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!style) return null;

  const toggle = async () => {
    const previous = style;
    const next = NEXT[previous];
    setStyle(next);
    setSaving(true);
    setError(null);
    try {
      await updateExplanationStyle(next);
    } catch (err) {
      setStyle(previous);
      setError(userErrorMessage(err, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  // Switch "Giải thích": bật = explained, tắt = concise. Nhãn cố định để trạng thái đọc từ công tắc, không từ chữ.
  const on = style === "explained";
  const label = t("styles.explained");
  return (
    <ChatToolbarTip label={t(`styles.${style}`)} hint={error ?? t(`hints.${style}`)}>
      {(describedBy) => (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => void toggle()}
          disabled={saving}
          aria-label={label}
          aria-describedby={describedBy}
          className={`h-8 px-1.5 shrink-0 rounded-control flex items-center gap-1.5 whitespace-nowrap text-body font-bold transition-colors cursor-pointer disabled:opacity-60 ${CHIP_ICON_ONLY_CLASS} ${
            error ? "text-error" : "text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          <span
            aria-hidden
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-outline"}`}
          >
            <span className={`inline-block h-3 w-3 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
          </span>
          <span data-chip-label className={CHIP_LABEL_CLASS}>{label}</span>
        </button>
      )}
    </ChatToolbarTip>
  );
}
