"use client";

import Icon from "@/components/ui/Icon";
import {
  CHAT_OPENING_GREETING,
  CHAT_OPENING_HINT,
  CHAT_OPENING_IDEAS,
  CHAT_OPENING_NO_IDEA,
  type ChatOpeningChip,
} from "./chat-opening.constants";

interface ChatOpeningProps {
  /** Bấm chip là gửi — đi đúng đường của một tin chat (chạy B-0.1). */
  onPick: (chip: ChatOpeningChip) => void;
  disabled?: boolean;
}

/**
 * Mở đầu project mới (FLF-221): lời chào cố định (không gọi model) + vài chip gợi ý. User không cần hiểu bước hay giai
 * đoạn — gõ ý tưởng (hoặc bấm chip) là AI bắt đầu.
 */
export default function ChatOpening({ onPick, disabled = false }: ChatOpeningProps) {
  const chip = (item: ChatOpeningChip, accent = false) => (
    <li key={item.label}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(item)}
        className={`min-h-9 px-3 py-1.5 rounded-control text-left text-[12.5px] font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ${
          accent ? "bg-primary-soft text-primary hover:bg-primary-light" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
        }`}
      >
        {accent && <Icon name="sparkle" size={14} />}
        {item.label}
      </button>
    </li>
  );

  return (
    <section className="flex items-start gap-3" aria-label="Bắt đầu dự án">
      <div
        aria-hidden
        className="w-7 h-7 rounded-[9px] text-white flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#8E87D6,#6A62C4)" }}
      >
        F
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-on-surface">{CHAT_OPENING_GREETING}</p>
        <div className="flex flex-col gap-2">
          <p className="text-[11.5px] font-semibold text-on-surface-muted">{CHAT_OPENING_HINT}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Gợi ý bắt đầu">
            {CHAT_OPENING_IDEAS.map((item) => chip(item))}
            {chip(CHAT_OPENING_NO_IDEA, true)}
          </ul>
        </div>
      </div>
    </section>
  );
}
