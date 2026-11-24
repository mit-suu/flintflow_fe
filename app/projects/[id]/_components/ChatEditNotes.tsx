"use client";

import { useTranslations } from "next-intl";
import type { PreviewResult } from "@/types/pipeline";
import { flagGroupTitle, readableMessage } from "./flag-rules";

const MAX_FLAGS = 3;

interface ChatEditNotesProps {
  preview: PreviewResult;
  sectionName?: (sectionId: string) => string;
}

/**
 * Phần phụ của thẻ xem trước lệnh sửa: AI cảnh báo, cờ đỏ dự báo, lý do cần xác nhận.
 * Giả định không có hộp riêng — lời trả lời trong chat đã nói thẳng như một BA.
 */
export default function ChatEditNotes({ preview, sectionName = (id) => id }: ChatEditNotesProps) {
  const t = useTranslations("workspace.chatEdit");
  const tRule = useTranslations("workspace.flagRules");
  const predicted = preview.predicted_red_flags ?? [];

  if (!preview.warning && predicted.length === 0 && !preview.confirm_reason) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {preview.warning && (
        <p className="rounded-control bg-accent-gold-soft px-3 py-2 text-body text-accent-gold-text leading-relaxed break-words">
          <span className="font-bold">{t("warningLead")}</span>
          {preview.warning}
        </p>
      )}
      {predicted.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-semibold text-error">{t("blocksBaseline")}</span>
          <ul className="flex flex-col gap-0.5">
            {predicted.slice(0, MAX_FLAGS).map((flag, i) => {
              const title = flagGroupTitle(flag.rule_id, tRule);
              const message = readableMessage(flag.message, flag.section_id, sectionName(flag.section_id));
              return (
                <li key={`${flag.rule_id}:${flag.target_id ?? flag.section_id}:${i}`} className="text-body text-on-surface-variant leading-relaxed break-words">
                  • {title ? <span className="font-semibold">{title}: </span> : null}
                  {message}
                </li>
              );
            })}
            {predicted.length > MAX_FLAGS && <li className="text-body text-on-surface-muted">{t("more", { count: predicted.length - MAX_FLAGS })}</li>}
          </ul>
        </div>
      )}
      {preview.confirm_reason && <p className="text-caption text-on-surface-muted leading-relaxed break-words">{t("confirmReason", { reason: preview.confirm_reason })}</p>}
    </div>
  );
}
