"use client";

import Link from "next/link";
import type { BadgeTone } from "@/components/ui/Badge";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { IMPORT_DONE_STATUSES, IMPORT_STATUS_LABELS } from "@/app/projects/[id]/_components/mode1/labels";
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
  /** Mode 1: số change request đang mở; `undefined` khi chưa tải / không áp dụng. */
  openCrs?: number;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
  /** Có ⇒ menu thêm "Chuyển vào thư mục". */
  onMoveToFolder?: (p: Project) => void;
  /** Tên thư mục chứa dự án — hiện chip ở tab "Dự án" (nơi hiện cả dự án trong thư mục). */
  folderName?: string | null;
  /** Cho kéo card thả vào thẻ thư mục. */
  draggable?: boolean;
}

/** Kiểu dữ liệu kéo thả: id dự án — thẻ thư mục chỉ nhận đúng kiểu này. */
export const PROJECT_DRAG_TYPE = "application/x-flintflow-project";

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

/**
 * Mode 1 (UC-14, UC-19): chưa import xong ⇒ trạng thái import; đã có baseline ⇒ số change request đang mở.
 * Trạng thái lấy từ `project.import_state` do BE trả.
 */
export function mode1NextLabel(project: Project, openCrs?: number): string {
  const state = project.import_state;
  if (!state) return "Chưa tải SRS lên — mở để upload .docx";
  if (!IMPORT_DONE_STATUSES.includes(state)) return `Nhập SRS: ${IMPORT_STATUS_LABELS[state]}`;
  if (openCrs === undefined) return IMPORT_STATUS_LABELS[state];
  return openCrs > 0 ? `${openCrs} change request đang mở` : IMPORT_STATUS_LABELS[state];
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
 * Card dự án kiểu Floe: bìa màu trơn theo mode, thân trắng bo lớn phủ lên bìa với một "tab" khoét ở góc phải chứa
 * nút ⋮, meta "thời gian • trạng thái", tên (font mono), vạch ngăn, footer việc tiếp theo + chip nguồn.
 */
export default function ProjectCard({
  project,
  progress,
  locale = "vi",
  openCrs,
  onRename,
  onDelete,
  onHardDelete,
  onMoveToFolder,
  folderName,
  draggable = false,
}: Props) {
  const status = getStatusBadge(progress);
  const mode = getSourceModeOption(project.mode);
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
      data-mode={project.mode}
      draggable={draggable || undefined}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(PROJECT_DRAG_TYPE, project._id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      className={`relative flex flex-col rounded-[20px] border border-outline-variant transition-shadow shadow-[0_1px_3px_rgba(25,24,23,0.05)] hover:shadow-[0_14px_30px_rgba(25,24,23,0.10)] ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <Link
        href={`/projects/${project._id}`}
        // Kéo cả card chứ không kéo URL của link
        draggable={false}
        className="flex flex-col flex-1 rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProjectCover seed={project._id} tone={mode.tone} className="h-[84px] rounded-t-[19px]" />

        <div className="relative -mt-5 flex flex-col flex-1 gap-1.5 rounded-[20px] rounded-tr-none bg-surface-container-lowest px-4 pt-3.5 pb-3.5">
          {/* Gờ nhô lên ở góc phải (chứa nút ⋮): cạnh trái đổ dốc chữ S xuống thân, góc phải bo — SVG cố định, tô màu thân */}
          <svg
            aria-hidden
            viewBox="0 0 96 18"
            fill="currentColor"
            className="absolute right-0 -top-[16px] h-[18px] w-[96px] text-surface-container-lowest"
          >
            <path d="M0 18C12 18 14 16 17 11C20 5 24 0 34 0H78Q96 0 96 18Z" />
          </svg>

          <div className="flex items-center gap-1.5 text-[11.5px] text-on-surface-muted pr-11">
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

          {folderName && (
            <span className="self-start inline-flex items-center gap-1 max-w-full text-[11px] font-semibold text-on-surface-variant">
              <Icon name="folder" size={12} className="text-on-surface-muted" />
              <span className="truncate">{folderName}</span>
            </span>
          )}

          <h3 className="font-mono text-[14.5px] font-medium text-on-surface leading-snug line-clamp-2">{project.name}</h3>

          <div className="h-px bg-outline-variant mt-auto mb-0.5" />

          <div className="flex items-center gap-2 pt-0.5">
            <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[11.5px] font-semibold text-on-surface-variant">
              <Icon name="arrow-right" size={13} className="text-primary" />
              <span className="truncate">{project.mode === "import" ? mode1NextLabel(project, openCrs) : nextStepLabel(progress, locale)}</span>
            </span>
            <span title={mode.label} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-bold ${MODE_CHIP[mode.tone]}`}>
              <Icon name={mode.icon} size={12} />
              {mode.shortLabel}
            </span>
          </div>
        </div>
      </Link>

      {/* Ngoài Link để bấm menu không điều hướng; nằm đúng trong tab khoét */}
      <div className="absolute right-[16px] top-[53px] z-20">
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="pill"
              label={`Tuỳ chọn cho ${project.name}`}
              // Chấm dọc: xoay icon ngang có sẵn của Lineicons
              className="bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low [&_svg]:rotate-90"
            />
          )}
        />
      </div>
    </article>
  );
}
