"use client";

import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { tStep, type Locale } from "@/lib/i18n";
import { getSourceModeOption, type SourceModeTone } from "@/lib/project-source-mode";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";

interface Props {
  project: Project;
  /** `GET /projects/:id/progress`; `null` khi project chưa có Spine, `undefined` khi đang tải. */
  progress?: ProgressResponse | null;
  locale?: Locale;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
}

/**
 * T23: trạng thái thẻ đọc từ **readiness thật** của Spine, không phải phần trăm legacy trên document
 * Project (field section-based cũ, BE không còn cập nhật; T21 xoá).
 *
 * Thứ tự quyết định có chủ ý: **cờ đỏ thắng phần trăm**. Một tài liệu 90% section đã chấp nhận mà còn
 * khoá chết thì không "sẵn sàng" — đó đúng là điều kiện chặn baseline ở S-9.5.
 */
export function getStatusBadge(progress: ProgressResponse | null | undefined): { label: string; tone: BadgeTone } {
  if (progress && progress.readiness.red_open > 0) return { label: "Cần làm rõ", tone: "danger" };
  const accepted = progress?.readiness.accepted_pct ?? 0;
  if (progress && accepted >= 80) return { label: "Sẵn sàng", tone: "success" };
  if (progress && accepted >= 40) return { label: "Đang phân tích", tone: "primary" };
  return { label: "Bản nháp", tone: "neutral" };
}

/** Việc tiếp theo: step đang dở lấy từ registry. Chưa có Spine ⇒ nói thẳng là chưa bắt đầu. */
export function nextStepLabel(progress: ProgressResponse | null | undefined, locale: Locale = "vi"): string {
  if (progress === undefined) return "Đang tải…";
  const stepId = progress?.progress.current_step;
  if (!stepId) return "Chưa bắt đầu — mở để mô tả ý tưởng";
  return tStep(stepId, locale);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 172800) return "Hôm qua";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return `${Math.floor(seconds / 604800)} tuần trước`;
}

/** Dải màu đầu card theo source mode (token). */
export const MODE_STRIPE: Record<SourceModeTone, string> = {
  info: "bg-gradient-to-r from-info-border via-info-soft to-info-soft",
  warning: "bg-gradient-to-r from-accent-gold-border via-accent-gold-soft to-accent-gold-soft",
  primary: "bg-gradient-to-r from-primary-fixed via-primary-soft to-primary-soft",
};

const MODE_ICON_TONE: Record<SourceModeTone, string> = {
  info: "text-info",
  warning: "text-accent-gold-text",
  primary: "text-primary",
};

export default function ProjectCard({ project, progress, locale = "vi", onRename, onDelete, onHardDelete }: Props) {
  const status = getStatusBadge(progress);
  const mode = getSourceModeOption(project.sourceMode);
  const archived = project.status === "archived";

  const menuItems: DropdownMenuItem[] = [
    { label: "Đổi tên", icon: "pencil", onSelect: () => onRename(project) },
    // Dự án đã lưu trữ không lưu trữ lại được
    ...(archived ? [] : [{ label: "Lưu trữ", icon: "archive", onSelect: () => onDelete(project) } as const]),
    { label: "Xoá vĩnh viễn", icon: "trash", tone: "danger", onSelect: () => onHardDelete(project) },
  ];

  return (
    <Card interactive className="relative flex flex-col overflow-visible" data-mode={project.sourceMode}>
      {/* Bọc riêng để định vị: gốc của DropdownMenu tự là `relative` (neo menu) */}
      <div className="absolute top-3 right-3 z-20">
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="sm"
              label={`Tuỳ chọn cho ${project.name}`}
              className="bg-surface-container-lowest/90 shadow-[0_2px_8px_rgba(25,24,23,0.1)]"
            />
          )}
        />
      </div>

      <Link
        href={`/projects/${project._id}`}
        className="flex flex-col flex-1 rounded-[16px] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className={`h-16 shrink-0 flex items-end px-4 pb-2.5 ${MODE_STRIPE[mode.tone]}`}>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${MODE_ICON_TONE[mode.tone]}`}>
            <Icon name={mode.icon} size={13} />
            {mode.shortLabel}
          </span>
        </div>

        <div className="flex flex-col gap-2 flex-1 p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {archived && <Badge>Đã lưu trữ</Badge>}
          </div>

          <div className="font-extrabold text-on-surface text-[14.5px] leading-snug line-clamp-2">{project.name}</div>

          <div className="text-[11.5px] text-on-surface-muted">
            {timeAgo(project.updatedAt)} · {mode.shortLabel}
          </div>

          <div className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 mt-auto text-[11.5px] font-semibold bg-surface-container-low text-on-surface-variant">
            <Icon name="arrow-right" size={13} className="text-primary" />
            <span className="truncate">{nextStepLabel(progress, locale)}</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
