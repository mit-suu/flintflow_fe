"use client";

import Link from "next/link";
import type { BadgeTone } from "@/components/ui/Badge";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { tStep, type Locale } from "@/lib/i18n";
import { getSourceModeOption, type SourceModeTone } from "@/lib/project-source-mode";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";
import ProjectCover from "./ProjectCover";

interface Props {
  project: Project;
  /** `GET /projects/:id/progress`; `null` khi project chưa có Spine, `undefined` khi đang tải. */
  progress?: ProgressResponse | null;
  locale?: Locale;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
  /** Có ⇒ menu thêm "Chuyển vào thư mục". */
  onMoveToFolder?: (p: Project) => void;
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

const MODE_CHIP: Record<SourceModeTone, string> = {
  info: "bg-info-soft text-info",
  warning: "bg-accent-gold-soft text-accent-gold-text",
  primary: "bg-primary-soft text-primary",
};

const STATUS_TEXT: Record<BadgeTone, string> = {
  neutral: "text-on-surface-muted",
  primary: "text-primary",
  success: "text-success",
  warning: "text-accent-gold-text",
  danger: "text-error",
  info: "text-info",
  soon: "text-on-surface-subtle",
};

const Dot = () => <span aria-hidden className="w-1 h-1 rounded-full bg-on-surface-subtle" />;

/**
 * Card dự án kiểu Floe: bìa gradient tự sinh, thân trắng bo lớn phủ lên bìa với một "tab" khoét ở góc phải chứa
 * nút ⋮, meta "thời gian • trạng thái", tên (font mono), vạch ngăn, footer việc tiếp theo + chip nguồn.
 */
export default function ProjectCard({ project, progress, locale = "vi", onRename, onDelete, onHardDelete, onMoveToFolder }: Props) {
  const status = getStatusBadge(progress);
  const mode = getSourceModeOption(project.sourceMode);
  const archived = project.status === "archived";

  const menuItems: DropdownMenuItem[] = [
    { label: "Đổi tên", icon: "pencil", onSelect: () => onRename(project) },
    ...(onMoveToFolder ? [{ label: "Chuyển vào thư mục", icon: "folder", onSelect: () => onMoveToFolder(project) } as const] : []),
    // Dự án đã lưu trữ không lưu trữ lại được
    ...(archived ? [] : [{ label: "Lưu trữ", icon: "archive", onSelect: () => onDelete(project) } as const]),
    { label: "Xoá vĩnh viễn", icon: "trash", tone: "danger", onSelect: () => onHardDelete(project) },
  ];

  return (
    <article
      data-mode={project.sourceMode}
      className="relative flex flex-col rounded-[22px] transition-shadow shadow-[0_1px_2px_rgba(25,24,23,0.04)] hover:shadow-[0_16px_36px_rgba(25,24,23,0.10)]"
    >
      <Link
        href={`/projects/${project._id}`}
        className="flex flex-col flex-1 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProjectCover seed={project._id} tone={mode.tone} className="h-[116px] rounded-t-[22px]" />

        <div className="relative -mt-8 flex flex-col flex-1 gap-2 rounded-[22px] rounded-tr-none bg-surface-container-lowest px-5 pt-4 pb-4">
          {/* Tab nhô lên ở góc phải (chứa nút ⋮) + góc lõm nối tab với thân */}
          <span aria-hidden className="absolute right-0 -top-[24px] h-[25px] w-[76px] rounded-tl-[16px] rounded-tr-[22px] bg-surface-container-lowest" />
          <span aria-hidden className="absolute right-[76px] -top-[14px] h-[14px] w-[14px] rounded-br-[14px] shadow-[5px_5px_0_5px] shadow-surface-container-lowest" />

          <div className="flex items-center gap-1.5 text-[11.5px] text-on-surface-muted pr-12">
            <span>{timeAgo(project.updatedAt)}</span>
            <Dot />
            <span className={`font-semibold ${STATUS_TEXT[status.tone]}`}>{status.label}</span>
            {archived && (
              <>
                <Dot />
                <span>Đã lưu trữ</span>
              </>
            )}
          </div>

          <h3 className="font-mono text-[15px] font-medium text-on-surface leading-snug line-clamp-2">{project.name}</h3>

          <div className="h-px bg-outline-variant mt-auto" />

          <div className="flex items-center gap-2 pt-0.5">
            <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[11.5px] font-semibold text-on-surface-variant">
              <Icon name="arrow-right" size={13} className="text-primary" />
              <span className="truncate">{nextStepLabel(progress, locale)}</span>
            </span>
            <span title={mode.label} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-bold ${MODE_CHIP[mode.tone]}`}>
              <Icon name={mode.icon} size={12} />
              {mode.shortLabel}
            </span>
          </div>
        </div>
      </Link>

      {/* Ngoài Link để bấm menu không điều hướng; nằm đúng trong tab khoét */}
      <div className="absolute right-[24px] top-[66px] z-20">
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="sm"
              label={`Tuỳ chọn cho ${project.name}`}
              className="bg-surface-container-low border border-outline-variant hover:bg-surface-container-high"
            />
          )}
        />
      </div>
    </article>
  );
}
