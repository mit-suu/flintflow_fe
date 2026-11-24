"use client";

import { useLocale, useTranslations } from "next-intl";
import { ActivityRow, ElapsedTimer, type AiWaitKind } from "@/components/ui/ai-activity";
import type { RunStage } from "@/types/pipeline";
import { activityLines, type LoggedEvent } from "./activity-log";

/** Giai đoạn ⇒ bộ câu chờ của chữ phụ. */
const HINT_KIND: Partial<Record<RunStage, AiWaitKind>> = { intake: "generic", ask: "chat", draft: "document", check: "check", render: "diagram" };

interface RunActivityLogProps {
  events: readonly LoggedEvent[];
  /** Lượt đang chạy ⇒ dòng đang làm có vòng quay, ánh sáng chạy, ba chấm và đồng hồ. */
  running: boolean;
  /** Mốc bắt đầu lượt (ms epoch) cho đồng hồ. */
  since?: number | null;
}

/**
 * Nhật ký hoạt động trong luồng chat (FLF-221): danh sách việc thật của lượt chạy hiện thẳng, không tiêu đề — xong ✓,
 * đang làm (ánh sáng chạy + ba chấm + đồng hồ lượt), chưa tới mờ, mục vừa ghi nằm dưới việc soạn. Mỗi giai đoạn một dòng
 * (soạn lại ⇒ nhãn "Lần 2"). Dựng lại được sau reload vì sự kiện lưu ở run-state.
 */
export default function RunActivityLog({ events, running, since }: RunActivityLogProps) {
  const t = useTranslations("workspace.activityLog");
  const lines = activityLines(events, running, useLocale());
  if (lines.length === 0) return null;

  return (
    <ol role="status" aria-live="polite" aria-label={t("aria")} className="flex flex-col min-w-0 py-1 pl-0.5">
      {lines.map((line) =>
        line.kind === "step" ? (
          // Chạy liền nhiều bước: tên bước là nhãn nhóm nhỏ
          <li key={line.key} title={line.title} className="pb-1.5 pt-1 first:pt-0 text-caption font-semibold text-on-surface-variant">
            {line.text}
          </li>
        ) : (
          <ActivityRow
            key={line.key}
            status={line.status}
            details={line.details}
            badge={(line.round ?? 1) > 1 ? t("round", { n: line.round ?? 2 }) : undefined}
            // Đồng hồ cả lượt nằm cạnh việc đang làm
            trailing={line.status === "running" ? <ElapsedTimer since={since} className="shrink-0 text-caption text-on-surface-subtle" /> : undefined}
            // Việc đang làm kéo dài ⇒ chữ phụ đổi dần dưới dòng, đếm từ lúc việc đó bắt đầu
            hint={line.status === "running" && line.at ? { kind: HINT_KIND[line.stage ?? "draft"] ?? "generic", since: line.at } : undefined}
          >
            {line.text}
          </ActivityRow>
        )
      )}
    </ol>
  );
}
