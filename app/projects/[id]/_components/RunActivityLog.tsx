"use client";

import Icon from "@/components/ui/Icon";
import { activityLines, type LoggedEvent } from "./activity-log";

interface RunActivityLogProps {
  events: readonly LoggedEvent[];
  /** Lượt đang chạy ⇒ dòng cuối là việc đang làm (vòng quay), chưa có ✓. */
  running: boolean;
}

/**
 * Nhật ký hoạt động trong luồng chat (FLF-221): thay dòng "AI đang suy nghĩ" bằng danh sách việc thật của lượt chạy,
 * kiểu IDE báo việc của agent — việc xong có ✓, việc đang làm có vòng quay, việc ghi dữ liệu kèm các mục vừa ghi thụt
 * dòng bên dưới. Dựng lại được sau reload vì sự kiện lưu ở run-state.
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
          <li key={line.key} className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 text-[12.5px] min-w-0">
            <span aria-hidden className="size-4 shrink-0 flex items-center justify-center">
              {line.status === "running" ? (
                <Icon name="spinner" size={12} className="text-primary animate-spin motion-reduce:animate-none" />
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
            </div>
            {line.details.length > 0 && (
              <ul className="ml-6 flex flex-col gap-0.5 text-[12px] text-on-surface-muted">
                {line.details.map((detail, index) => (
                  <li key={index} className="flex gap-1.5 min-w-0">
                    <span aria-hidden className="shrink-0">└</span>
                    <span className="min-w-0 truncate">{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      )}
    </ol>
  );
}
