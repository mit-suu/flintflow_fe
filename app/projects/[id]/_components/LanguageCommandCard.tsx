"use client";

import Icon from "@/components/ui/Icon";
import type { LanguageCommandOutcome } from "@/lib/document-language-command";
import type { DocumentLanguage } from "@/types/project";

/** Tên ngôn ngữ đặt giữa câu tiếng Việt ("Đổi tài liệu sang tiếng Anh?") — khác chip, chip ghi tên bằng chính ngôn ngữ đó. */
const IN_SENTENCE: Record<DocumentLanguage, string> = { vi: "tiếng Việt", en: "tiếng Anh" };

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
  const title =
    kind === "switch"
      ? `Đổi tài liệu sang ${IN_SENTENCE[target]}?`
      : kind === "same"
        ? `Tài liệu đang là ${IN_SENTENCE[target]}`
        : "Dự án upload giữ ngôn ngữ của file tải lên";
  const note =
    kind === "switch"
      ? target === sourceLanguage
        ? `${capitalize(IN_SENTENCE[target])} là ngôn ngữ gốc của tài liệu — chỉ đổi ngôn ngữ hiển thị và bản xuất, không cần dịch, không tốn credit.`
        : `Nội dung hiện có cần dịch sang ${IN_SENTENCE[target]}. Số mục và credit ước tính hiện ở bước tiếp theo — bạn xác nhận rồi mới dịch.`
      : kind === "same"
        ? missing !== null && missing > 0
          ? `Còn ${missing} mục chưa dịch, đang hiện chữ gốc.`
          : "Không cần đổi gì."
        : "Ngôn ngữ tài liệu theo đúng file bạn đã tải lên, không đổi hay dịch được.";

  return (
    <div role="status" aria-label="Ngôn ngữ tài liệu" className="self-stretch rounded-card bg-surface-container-lowest p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="w-7 h-7 shrink-0 grid place-items-center rounded-inner bg-primary-soft text-primary">
          <Icon name="translate" size={14} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-body font-semibold text-on-surface">{title}</span>
          <p className="text-body text-on-surface-muted leading-relaxed">{note}</p>
          <p className="text-caption text-on-surface-muted break-words">Bạn gõ: “{text}”</p>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng thẻ ngôn ngữ"
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
          {kind === "switch" ? "Không, gửi như tin nhắn" : "Gửi như tin nhắn"}
        </button>
        {kind === "same" && missing !== null && missing > 0 && (
          <button type="button" onClick={onTranslate} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`}>
            Dịch {missing} mục còn thiếu
          </button>
        )}
        {kind === "switch" && (
          <button type="button" onClick={onConfirm} disabled={busy} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`}>
            {busy ? "Đang đổi…" : "Đồng ý"}
          </button>
        )}
      </div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
