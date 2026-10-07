"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { CHAT_OPENING_IDEAS, CHAT_OPENING_NO_IDEA, type ChatOpeningChip, type ChatOpeningPick } from "./chat-opening.constants";

interface ChatOpeningProps {
  /** Bấm chip là gửi — đi đúng đường của một tin chat (chạy B-0.1). */
  onPick: (pick: ChatOpeningPick) => void;
  disabled?: boolean;
}

/**
 * Mở đầu project mới (FLF-221): lời chào cố định (không gọi model) + vài chip gợi ý. User không cần hiểu bước hay giai
 * đoạn — gõ ý tưởng (hoặc bấm chip) là AI bắt đầu. Chữ theo ngôn ngữ giao diện (FLF-260): chip gửi câu đã dịch, BE lấy
 * ngôn ngữ của câu đó làm ngôn ngữ trả lời.
 */
export default function ChatOpening({ onPick, disabled = false }: ChatOpeningProps) {
  const t = useTranslations("workspace.chatOpening");

  const chip = ({ key, intent }: ChatOpeningChip, accent = false) => (
    <li key={key}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick({ message: t(`chips.${key}.message`), intent })}
        className={`min-h-9 px-3 py-1.5 rounded-control text-left text-[12.5px] font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ${
          accent ? "bg-primary-soft text-primary hover:bg-primary-light" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
        }`}
      >
        {accent && <Icon name="sparkle" size={14} />}
        {t(`chips.${key}.label`)}
      </button>
    </li>
  );

  return (
    <section className="flex items-start" aria-label={t("aria")}>
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <p className="text-[14px] leading-7 text-on-surface">{t("greeting")}</p>
        <div className="flex flex-col gap-2">
          <p className="text-[11.5px] font-semibold text-on-surface-muted">{t("hint")}</p>
          <ul className="flex flex-wrap gap-2" aria-label={t("suggestionsAria")}>
            {CHAT_OPENING_IDEAS.map((item) => chip(item))}
            {chip(CHAT_OPENING_NO_IDEA, true)}
          </ul>
        </div>
      </div>
    </section>
  );
}
