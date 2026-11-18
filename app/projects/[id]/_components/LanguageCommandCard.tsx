"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { LanguageCommandOutcome } from "@/lib/document-language-command";
import type { DocumentLanguage } from "@/types/project";

interface LanguageCommandCardProps {
  kind: Exclude<LanguageCommandOutcome, "send">;
  /** Câu user vừa gõ — gửi đi nguyên văn nếu bấm "Gửi như tin nhắn". */
  text: string;
  target: DocumentLanguage;
  /** Ngôn ngữ gốc của Spine: đổi về đúng nó thì không cần dịch, không tốn credit. */
  sourceLanguage: DocumentLanguage;
  /** `same`: số mục còn in chữ gốc (`null` = chưa biết / không áp dụng). */
  missing?: number | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onTranslate: () => void;
  onSendAsMessage: () => void;
  onCancel: () => void;
}

const BUTTON = "h-8 px-3 rounded-control text-body font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors";

/**
 * Thẻ trong dòng chat khi câu gõ là lệnh đổi ngôn ngữ tài liệu (FLF-265 §3.7, D15) — câu đó KHÔNG đi tới AI (AI sẽ viết lại
 * chữ Spine sang ngôn ngữ khác, Spine phải giữ tiếng Anh). Ba dạng:
 * - `switch`: hỏi xác nhận đổi; đích là ngôn ngữ gốc thì nói rõ không cần dịch, còn lại ước tính credit ở bước sau;
 * - `same`: tài liệu đã ở ngôn ngữ đó — còn mục chưa dịch thì mời dịch nốt;
 * - `locked`: mode 1 giữ ngôn ngữ của file tải lên (D3).
 * Dạng nào cũng có "Gửi như tin nhắn" — khớp nhầm thì user vẫn gửi được câu của mình như cũ.
 */
export default function LanguageCommandCard({
  kind,
  text,
  target,
  sourceLanguage,
  missing = null,
  busy = false,
  error = null,
  onConfirm,
  onTranslate,
  onSendAsMessage,
  onCancel,
}: LanguageCommandCardProps) {
  const t = useTranslations("workspace.languageCommand");
  // Tên ngôn ngữ đặt giữa câu ("Đổi tài liệu sang tiếng Anh?") — khác chip, chip ghi tên bằng chính ngôn ngữ đó
  const language = t(`inSentence.${target}`);
  const title =
    kind === "switch" ? t("switchTitle", { language }) : kind === "same" ? t("sameTitle", { language }) : t("lockedTitle");
  const note =
    kind === "switch"
      ? target === sourceLanguage
        ? t("switchToSource", { language: t(`inSentenceCap.${target}`) })
        : t("switchTranslate", { language })
      : kind === "same"
        ? missing !== null && missing > 0
          ? t("sameMissing", { count: missing })
          : t("sameNothing")
        : t("lockedNote");

  return (
    <div role="status" aria-label={t("aria")} className="self-stretch rounded-card bg-surface-container-lowest p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="w-7 h-7 shrink-0 grid place-items-center rounded-inner bg-primary-soft text-primary">
          <Icon name="translate" size={14} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-body font-semibold text-on-surface">{title}</span>
          <p className="text-body text-on-surface-muted leading-relaxed">{note}</p>
          <p className="text-caption text-on-surface-muted break-words">{t("youTyped", { text })}</p>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("close")}
            className="w-6 h-6 shrink-0 grid place-items-center rounded-inner text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors"
          >
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onSendAsMessage}
          disabled={busy}
          className={`${BUTTON} text-on-surface-variant hover:bg-surface-container-high`}
        >
          {kind === "switch" ? t("sendAsMessageNo") : t("sendAsMessage")}
        </button>
        {kind === "same" && missing !== null && missing > 0 && (
          <button type="button" onClick={onTranslate} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`}>
            {t("translateMissing", { count: missing })}
          </button>
        )}
        {kind === "switch" && (
          <button type="button" onClick={onConfirm} disabled={busy} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`}>
            {busy ? t("switching") : t("agree")}
          </button>
        )}
      </div>
    </div>
  );
}
