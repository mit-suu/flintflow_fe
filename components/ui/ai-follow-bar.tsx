"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { ElapsedTimer } from "@/components/ui/ai-activity";
import { STICKY_FADE } from "@/components/ui/sticky-styles";
import type { AiFollow } from "@/lib/hooks/use-ai-follow";

interface AiFollowBarProps {
  /** Kết quả của `useAiFollow`. */
  follow: Pick<AiFollow, "following" | "setFollowing" | "total" | "index" | "prev" | "next">;
  /** Chữ khi không có mục nào đang đọc (đang dựng / kiểm tra): ‹ › ẩn đi, đồng hồ vẫn chạy. */
  idleLabel?: ReactNode;
  /** Mốc bắt đầu của đồng hồ (ms epoch); không truyền ⇒ từ lúc thanh hiện ra. */
  since?: number | null;
  /** false ⇒ dừng spinner và đồng hồ (đang tạm dừng). */
  running?: boolean;
  /** Việc AI đang làm ở các mục: đọc file (màn import) hay soạn tài liệu (workspace). */
  verb?: "reading" | "writing";
  /** Padding ngang cho khớp vùng cuộn chứa thanh. */
  className?: string;
}

const NAV_BUTTON =
  "size-8 shrink-0 rounded-control flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * Thanh dính ở đầu khung tài liệu khi AI đang đọc / viết: `⠹ Đang đọc 2/4   ‹ ›   Theo dõi AI`. Chỉ trình bày — trạng thái và
 * cuộn nằm ở `useAiFollow`. Phẳng, không viền; nút ≥ 32px, có vòng focus.
 */
export function AiFollowBar({ follow, idleLabel, since, running = true, verb = "reading", className = "" }: AiFollowBarProps) {
  const t = useTranslations("aiFollow");
  const { following, setFollowing, total, index, prev, next } = follow;
  return (
    <div className={`sticky top-0 z-10 flex items-center gap-2 bg-surface-container-lowest py-2 ${STICKY_FADE} ${className}`.trim()}>
      {running && <Icon name="spinner" size={14} className="shrink-0 text-primary animate-spin motion-reduce:animate-none" />}
      <span className="min-w-0 truncate text-body font-medium text-on-surface">{total > 0 ? t(verb, { index: Math.max(index, 1), total }) : idleLabel}</span>
      <ElapsedTimer since={since} running={running} className="shrink-0 text-caption text-on-surface-muted" />
      <span className="flex-1" />
      {total > 0 && (
        <span className="flex items-center">
          <button type="button" onClick={prev} aria-label={t("prev")} title={t("prev")} className={NAV_BUTTON}>
            <Icon name="chevron-up" size={16} />
          </button>
          <button type="button" onClick={next} aria-label={t("next")} title={t("next")} className={NAV_BUTTON}>
            <Icon name="chevron-down" size={16} />
          </button>
        </span>
      )}
      {total > 0 && (
        <button
          type="button"
          aria-pressed={following}
          onClick={() => setFollowing(!following)}
          className={`h-8 shrink-0 rounded-full px-3 flex items-center gap-1.5 text-caption font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${following ? "bg-primary-soft text-primary" : "bg-surface-container text-on-surface-muted hover:text-on-surface"}`}
        >
          <Icon name={following ? "eye" : "eye-off"} size={13} />
          {t("follow")}
        </button>
      )}
    </div>
  );
}
