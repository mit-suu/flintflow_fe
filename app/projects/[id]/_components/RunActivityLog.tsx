"use client";

import Icon from "@/components/ui/Icon";
import { activityLines, type LoggedEvent } from "./activity-log";

interface RunActivityLogProps {
  events: readonly LoggedEvent[];
  /** Lượt đang chạy ⇒ dòng cuối là việc đang làm (chấm nhịp), chưa có ✓. */
  running: boolean;
}

/**
 * Nhật ký hoạt động trong luồng chat (FLF-221): thay dòng "AI đang suy nghĩ" bằng danh sách việc thật của lượt chạy —
 * mỗi việc xong có ✓ và thời lượng, việc đang làm có chấm nhịp. Dựng lại được sau reload vì sự kiện lưu ở run-state.
 */
export default function RunActivityLog({ events, running }: RunActivityLogProps) {
  const lines = activityLines(events, running);
  if (lines.length === 0) return null;

  return (
    <ol className="flex flex-col gap-1" aria-label="Nhật ký hoạt động của AI">
      {lines.map((line) =>
        line.kind === "step" ? (
          <li key={line.key} className="pt-1 first:pt-0 text-[11.5px] font-semibold text-on-surface-variant">
            {line.text}
          </li>
        ) : (
          <li key={line.key} className="flex items-center gap-2 text-[12.5px] min-w-0">
            <span aria-hidden className="size-4 shrink-0 flex items-center justify-center">
              {line.status === "running" ? (
                <span className="size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />
              ) : line.status === "failed" ? (
                <Icon name="warning" size={13} className="text-error" />
              ) : (
                <Icon name="check" size={13} className="text-success" />
              )}
            </span>
            <span className={`flex-1 min-w-0 truncate ${line.status === "running" ? "text-on-surface" : line.status === "failed" ? "text-error" : "text-on-surface-variant"}`}>
              {line.text}
              <span className="sr-only">{line.status === "running" ? " (đang làm)" : line.status === "failed" ? " (lỗi)" : " (xong)"}</span>
            </span>
            {line.duration && <span className="shrink-0 tabular-nums text-[11px] text-on-surface-muted">{line.duration}</span>}
          </li>
        )
      )}
    </ol>
  );
}
