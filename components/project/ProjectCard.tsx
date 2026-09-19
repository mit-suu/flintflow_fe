"use client";

import Link from "next/link";
import type { BadgeTone } from "@/components/ui/Badge";
import DropdownMenu, {
  type DropdownMenuItem
} from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { tStep, type Locale } from "@/lib/i18n";
import {
  PHASES,
  PHASE_LABELS_VI,
  type PhaseId
} from "@/lib/constants/step-registry";
import { getSourceModeOption } from "@/lib/project-source-mode";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project, ProjectSourceMode } from "@/types/project";

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
export function getStatusBadge(progress: ProgressResponse | null | undefined): {
  label: string;
  tone: BadgeTone;
} {
  // Amber chứ không đỏ: đây là việc cần làm trong luồng bình thường, không phải lỗi
  if (progress && progress.readiness.red_open > 0)
    return { label: "Cần làm rõ", tone: "warning" };
  const accepted = progress?.readiness.accepted_pct ?? 0;
  if (progress && accepted >= 80) return { label: "Sẵn sàng", tone: "success" };
  if (progress && accepted >= 40)
    return { label: "Đang phân tích", tone: "primary" };
  return { label: "Bản nháp", tone: "neutral" };
}

/** Việc tiếp theo: step đang dở lấy từ registry. Chưa có Spine ⇒ nói thẳng là chưa bắt đầu. */
export function nextStepLabel(
  progress: ProgressResponse | null | undefined,
  locale: Locale = "vi"
): string {
  if (progress === undefined) return "Đang tải…";
  const stepId = progress?.progress.current_step;
  if (!stepId) {
    // Không có step đang chạy chưa chắc là chưa bắt đầu: có thể đã xong hết, hoặc đang dừng giữa chừng (vd. chờ gate)
    const p = progress?.progress;
    if (p && p.total > 0 && p.done >= p.total) return "Đã hoàn tất";
    if (p && p.done > 0) return "Mở để tiếp tục";
    return "Chưa bắt đầu — mở để mô tả ý tưởng";
  }
  return tStep(stepId, locale);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600)
    return `${Math.max(1, Math.floor(seconds / 60))} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 172800) return "Hôm qua";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return `${Math.floor(seconds / 604800)} tuần trước`;
}

/** Nguồn mặc định (gần như mọi dự án) — không ghi nhãn trên card; chỉ nguồn khác mới hiện tên. */
const DEFAULT_SOURCE_MODE: ProjectSourceMode = "fpt_template";

/**
 * Vị trí trên thanh 12 giai đoạn. Đếm theo **phase** chứ không theo % bước: tổng bước (51 + 5×N) chỉ chốt
 * sau S-4.1 (`show_percent`), nên thanh theo % sẽ thụt lùi khi N được chốt; số phase thì cố định.
 * `done`: số phase đã qua; `current`: index phase đang làm (-1 nếu chưa bắt đầu hoặc đã xong hết).
 */
export function phasePosition(progress: ProgressResponse | null | undefined): {
  done: number;
  current: number;
} {
  const p = progress?.progress;
  if (!p) return { done: 0, current: -1 };
  if (p.total > 0 && p.done >= p.total)
    return { done: PHASES.length, current: -1 };
  const current = PHASES.indexOf(p.current_phase as PhaseId);
  return current < 0 ? { done: 0, current: -1 } : { done: current, current };
}

/**
 * Thanh tiến độ liền theo 12 giai đoạn: phần đã qua tô đậm, giai đoạn đang làm nối tiếp bằng tô nhạt, còn lại là rãnh.
 * LƯU Ý: màu rãnh (`card-track`) và màu chữ của card là một bộ với `surface-card` (xem `app/globals.css`) —
 * đổi màu card thì phải đổi cả màu rãnh/chữ cho phù hợp.
 */
function PhaseBar({
  progress
}: {
  progress: ProgressResponse | null | undefined;
}) {
  const { done, current } = phasePosition(progress);
  const label =
    current >= 0
      ? `Giai đoạn ${current + 1}/${PHASES.length}: ${PHASE_LABELS_VI[PHASES[current]]}`
      : done === PHASES.length
        ? "Đã qua đủ 12 giai đoạn"
        : "Chưa bắt đầu";
  const width = (phases: number) => `${(phases / PHASES.length) * 100}%`;
  return (
    <div
      role="progressbar"
      aria-label="Tiến độ theo giai đoạn"
      aria-valuemin={0}
      aria-valuemax={PHASES.length}
      aria-valuenow={done}
      aria-valuetext={label}
      title={label}
      className="relative h-2 rounded-full bg-card-track overflow-hidden">
      {current >= 0 && (
        <span
          data-part="current"
          className="absolute inset-y-0 left-0 rounded-full bg-primary/35"
          style={{ width: width(done + 1) }}
        />
      )}
      {done > 0 && (
        <span
          data-part="done"
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: width(done) }}
        />
      )}
    </div>
  );
}

/** Trạng thái chỉ tô màu ở chấm tròn, để thanh tiến độ là điểm nhấn màu chính của card. */
const STATUS_DOT: Record<BadgeTone, string> = {
  neutral: "bg-on-surface-subtle",
  // "Đang phân tích": xanh lá tươi (không tím — tím dành cho thanh tiến độ); "Sẵn sàng" (success) là xanh lá đậm
  primary: "bg-success-dark",
  success: "bg-success",
  warning: "bg-accent-gold",
  danger: "bg-error",
  info: "bg-info",
  soon: "bg-on-surface-subtle"
};

const Dot = () => (
  <span
    aria-hidden
    className="w-1 h-1 shrink-0 rounded-full bg-on-card-variant/50"
  />
);

/**
 * Card dự án: nền trắng ngà lạnh (thẻ thư mục có màu ⇒ nhìn là phân biệt được), meta "trạng thái • thời gian",
 * tên, footer việc tiếp theo + thanh 12 giai đoạn. Màu chữ/rãnh dùng bộ token `*-card` đi cùng màu nền card.
 */
export default function ProjectCard({
  project,
  progress,
  locale = "vi",
  onRename,
  onDelete,
  onHardDelete,
  onMoveToFolder,
  folderName,
  draggable = false
}: Props) {
  const status = getStatusBadge(progress);
  const mode = getSourceModeOption(project.sourceMode);
  const archived = project.status === "archived";

  const menuItems: DropdownMenuItem[] = [
    { label: "Đổi tên", icon: "pencil", onSelect: () => onRename(project) },
    ...(onMoveToFolder
      ? [
          {
            label: "Chuyển vào thư mục",
            icon: "folder",
            onSelect: () => onMoveToFolder(project)
          } as const
        ]
      : []),
    // Dự án đã lưu trữ không lưu trữ lại được
    ...(archived
      ? []
      : [
          {
            label: "Lưu trữ",
            icon: "archive",
            onSelect: () => onDelete(project)
          } as const
        ]),
    {
      label: "Xoá vĩnh viễn",
      icon: "trash",
      tone: "danger",
      onSelect: () => onHardDelete(project)
    }
  ];

  return (
    <article
      data-mode={project.sourceMode}
      draggable={draggable || undefined}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(PROJECT_DRAG_TYPE, project._id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      // Nền phẳng tím nhạt như thẻ thư mục (đổi màu này thì đổi cả màu chữ/rãnh tiến độ — xem PhaseBar), không viền, không bóng; hover ngả tím nhạt.
      // Đang mở menu ⋮ ⇒ nâng cả card (z-21 > nút ⋮ z-20 của card khác, < tiêu đề mục dính z-25), để menu không bị nút ⋮ của card bên dưới đè lên
      className={`relative flex flex-col rounded-card bg-surface-card transition-colors duration-200 hover:bg-surface-card-hover has-[[aria-expanded=true]]:z-[21] ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}>
      <Link
        href={`/projects/${project._id}`}
        // Kéo cả card chứ không kéo URL của link
        draggable={false}
        // Thứ bậc: tên (đậm, đậm màu nhất) → meta nhạt → tiến độ ở đáy. Chỉ tên được in đậm để mắt biết đọc gì trước.
        className="flex flex-col flex-1 min-h-[156px] rounded-card p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <h3 className="pr-8 text-[15px] font-semibold text-on-card leading-[1.4] line-clamp-2">{project.name}</h3>

        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-on-card-variant">
          <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status.tone]}`} />
          <span className="shrink-0 whitespace-nowrap">{status.label}</span>
          <Dot />
          <span className="shrink-0 whitespace-nowrap">{timeAgo(project.updatedAt)}</span>
          {/* Thư mục nằm trong dòng meta, không thêm hàng riêng (chỉ vài card có ⇒ làm lệch hàng) */}
          {folderName && (
            <>
              <Dot />
              <span className="min-w-0 inline-flex items-center gap-1" title={`Thư mục ${folderName}`}>
                <Icon name="folder" size={12} className="shrink-0" />
                <span className="truncate">{folderName}</span>
              </span>
            </>
          )}
          {/* So theo nguồn đã phân giải: dự án thiếu `sourceMode` (BE có lúc không trả) được coi là mặc định */}
          {mode.value !== DEFAULT_SOURCE_MODE && (
            <>
              <Dot />
              <span title={mode.label} className="min-w-0 truncate">
                {mode.shortLabel}
              </span>
            </>
          )}
          {archived && (
            <>
              <Dot />
              <span className="shrink-0 whitespace-nowrap">Đã lưu trữ</span>
            </>
          )}
        </div>

        {/* Đáy card: bước tiếp theo, rồi một hàng [thanh tiến độ | số bước] */}
        <div className="mt-auto pt-6 flex flex-col gap-2">
          {/* Khác hẳn dòng meta (nhạt, thường): đậm vừa, màu đậm, mũi tên tím = "việc tiếp theo" */}
          <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] font-medium text-on-card-strong">
            <Icon name="arrow-right" size={13} className="shrink-0 text-primary" />
            <span className="truncate">{nextStepLabel(progress, locale)}</span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <PhaseBar progress={progress} />
            </div>
            {progress && progress.progress.total > 0 && (
              <span className="shrink-0 tabular-nums text-[11.5px] font-semibold text-on-card-strong">
                {progress.progress.done}/{progress.progress.total}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Ngoài Link để bấm menu không điều hướng; top căn giữa dòng tên (p-5 + nửa line-height − nửa nút) */}
      <div className="absolute right-3 top-[18px] z-20">
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="pill"
              label={`Tuỳ chọn cho ${project.name}`}
              // Nền trắng; hover không đổi màu mà chỉ phóng nhẹ. `!` để thắng hover xám + transition-colors mặc định của IconButton
              className="bg-surface-container-lowest text-on-card-variant! hover:bg-surface-container-lowest! hover:text-on-card-variant! transition-transform! duration-150 hover:scale-110 active:scale-100"
            />
          )}
        />
      </div>
    </article>
  );
}
