"use client";

import { useTranslations } from "next-intl";
import type { CrStatus } from "@/types/change-request";
import { useMode1Labels } from "./i18n";

type Stage = { key: string; statuses: readonly CrStatus[] };

/** Trang CR: đủ vòng đời, từ nháp tới ghi Track Changes. */
const FULL_STAGES = [
  { key: "draft", statuses: ["draft"] },
  { key: "clarify", statuses: ["clarifying", "awaiting_answers"] },
  { key: "impact", statuses: ["impact_review"] },
  { key: "propose", statuses: ["proposing"] },
  { key: "verify", statuses: ["verifying", "manual_fix"] },
  { key: "submit", statuses: ["ready_to_submit"] },
  { key: "review", statuses: ["in_review"] },
  { key: "written", statuses: ["written", "released"] },
] as const satisfies readonly Stage[];

/**
 * Khung chat: chỉ phần người tạo CR tự làm. Nháp gộp vào "Làm rõ" (chat mở CR là vào làm rõ luôn); gửi Lead xong thì khung chat
 * đứng ở bước cuối, phần duyệt / ghi xem ở trang CR.
 */
const CHAT_STAGES = [
  { key: "clarify", statuses: ["draft", "clarifying", "awaiting_answers"] },
  { key: "impact", statuses: ["impact_review"] },
  { key: "propose", statuses: ["proposing"] },
  { key: "verify", statuses: ["verifying", "manual_fix"] },
  { key: "submit", statuses: ["ready_to_submit", "in_review", "written", "released"] },
] as const satisfies readonly Stage[];

/**
 * Tiến trình CR (máy trạng thái ở BE, FE chỉ đặt nhãn). Một bảng nhãn dùng chung cho trang CR và khung chat để hai nơi luôn báo
 * cùng một bước; `compact` = bản gọn trong khung chat (5 bước, pill nhỏ, xuống dòng khi hẹp thay vì cắt chữ).
 */
export default function CrTimeline({ status, compact = false }: { status: CrStatus; compact?: boolean }) {
  const t = useTranslations("mode1.crTimeline");
  const { crStatus } = useMode1Labels();
  const stages: readonly Stage[] = compact ? CHAT_STAGES : FULL_STAGES;
  const ended = status === "rejected" || status === "cancelled";
  const current = stages.findIndex((s) => s.statuses.includes(status));
  const pill = compact ? "px-2 py-0.5 text-caption" : "px-2.5 py-1 text-body";
  return (
    <ol className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`} aria-label={t("aria")}>
      {stages.map((s, i) => (
        <li
          key={s.key}
          aria-current={i === current ? "step" : undefined}
          className={`${pill} rounded-full font-bold ${
            ended
              ? "bg-surface-container text-on-surface-muted opacity-60"
              : i < current
                ? "bg-success-soft text-success"
                : i === current
                  ? status === "written" || status === "released"
                    ? "bg-success text-white"
                    : "bg-on-surface text-surface"
                  : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {i < current && !ended ? "✓ " : ""}
          {s.key === "written" && status === "released" ? crStatus("released") : t(`stages.${s.key}`)}
        </li>
      ))}
      {ended && <li className={`${pill} rounded-full font-bold bg-error-container text-error`}>{crStatus(status)}</li>}
    </ol>
  );
}
