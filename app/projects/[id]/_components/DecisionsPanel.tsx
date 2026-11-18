"use client";

import { useLocale, useTranslations } from "next-intl";
import { workspaceStepLabel } from "./phase-labels";
import type { Spine } from "@/types/spine";

/**
 * Tab "Đã chốt" — sổ quyết định (`02-reduce-stops-plan.md` R4).
 *
 * Trong lượt test, user trả lời uptime ba lần và vẫn thấy AI gợi ý ngược lại điều mình vừa nói. Sổ này là
 * chỗ để họ **thấy** hệ thống nhớ gì. Sửa nếu nhớ sai đi qua chat (business-flow nguyên tắc 6: không sửa tay trong app) —
 * nút "Sửa qua chat" điền sẵn lệnh; AI sửa nguồn rồi lan sang các chỗ hệ quả.
 */

interface DecisionsPanelProps {
  spine: Spine | null;
  /** Điền sẵn lệnh sửa quyết định vào ô chat (bật Sửa tài liệu); bỏ trống (Viewer) ⇒ không có nút. */
  onEditByChat?: (prefill: string) => void;
  busy?: boolean;
}

/** Chủ đề chuẩn có nhãn (`messages → workspace.decisions.topic`); chủ đề tự do hiện nguyên khoá. */
const TOPIC_KEYS = [
  "system_name",
  "form_factor",
  "stakes",
  "uptime",
  "concurrent_users",
  "response_time",
  "data_retention",
  "slot_hold_minutes",
  "deposit_amount",
  "cancel_window",
  "no_show_policy",
  "reminder_channel",
  "notification_channels",
  "ui_languages",
  "roles",
  "working_hours",
  "payment_method",
  "screen_scope",
  "release_scope",
] as const;

export type DecisionTopicKey = (typeof TOPIC_KEYS)[number];

const isTopicKey = (key: string): key is DecisionTopicKey => (TOPIC_KEYS as readonly string[]).includes(key);

/** `t` = `useTranslations("workspace.decisions")`. */
export const topicLabel = (topicKey: string, t: (key: `topic.${DecisionTopicKey}`) => string): string =>
  isTopicKey(topicKey) ? t(`topic.${topicKey}`) : topicKey.replace(/_/g, " ");

export default function DecisionsPanel({ spine, onEditByChat, busy = false }: DecisionsPanelProps) {
  const t = useTranslations("workspace.decisions");
  const locale = useLocale();
  const stepLabel = (stepId: string) => workspaceStepLabel(stepId, locale);
  const decisions = (spine?.decisions ?? []).filter((d) => d.superseded_by === null);

  if (decisions.length === 0) {
    return <p className="text-body text-on-surface-muted italic">{t("none")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={t("listAria")}>
      {decisions.map((decision) => (
        <li key={decision.id} className="bg-white border border-[#ECEAE5] rounded-[10px] p-2.5 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body font-bold text-[#191817]">{topicLabel(decision.topic_key, t)}</span>
            <span className="text-caption text-[#8A867E] shrink-0" title={`${decision.step_id} - ${decision.question}`}>
              {stepLabel(decision.step_id)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-body text-[#4B4842] min-w-0 break-words">{decision.answer}</span>
            {onEditByChat && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onEditByChat(t("editByChatPrefill", { topic: topicLabel(decision.topic_key, t), answer: decision.answer }))}
                className="text-caption font-bold text-[#6A62C4] hover:underline cursor-pointer shrink-0 disabled:opacity-50"
              >
                {t("editByChat")}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
