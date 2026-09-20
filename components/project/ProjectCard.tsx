"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { BadgeTone } from "@/components/ui/Badge";
import DropdownMenu, {
  type DropdownMenuItem
} from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { IMPORT_DONE_STATUSES, IMPORT_STATUS_LABELS } from "@/app/projects/[id]/_components/mode1/labels";
import { tStep, type Locale } from "@/lib/i18n";
import { timeAgo, type TimeTranslator } from "@/lib/time-ago";
import { PHASES, type PhaseId } from "@/lib/constants/step-registry";
import { tPhase } from "@/lib/i18n";
import { getSourceModeOption } from "@/lib/project-source-mode";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project, ProjectMode } from "@/types/project";

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
  /** Đang ở chế độ chọn nhiều: card hiện ô tích, bấm card là tích chứ không mở dự án. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (p: Project) => void;
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
export type ProjectStatusKey = "clarify" | "ready" | "analyzing" | "draft";

export function getStatusBadge(progress: ProgressResponse | null | undefined): {
  key: ProjectStatusKey;
  tone: BadgeTone;
} {
  // Amber chứ không đỏ: đây là việc cần làm trong luồng bình thường, không phải lỗi
  if (progress && progress.readiness.red_open > 0) return { key: "clarify", tone: "warning" };
  const accepted = progress?.readiness.accepted_pct ?? 0;
  if (progress && accepted >= 80) return { key: "ready", tone: "success" };
  if (progress && accepted >= 40) return { key: "analyzing", tone: "primary" };
  return { key: "draft", tone: "neutral" };
}

/** Hàm dịch của `app.projectCard.next` — truyền vào để `nextStepLabel` giữ nguyên tính thuần. */
export type NextTranslator = (key: "loading" | "done" | "resume" | "notStarted") => string;

/** Việc tiếp theo: step đang dở lấy từ registry. Chưa có Spine ⇒ nói thẳng là chưa bắt đầu. */
export function nextStepLabel(
  progress: ProgressResponse | null | undefined,
  t: NextTranslator,
  locale: Locale = "vi"
): string {
  if (progress === undefined) return t("loading");
  const stepId = progress?.progress.current_step;
  if (!stepId) {
    // Không có step đang chạy chưa chắc là chưa bắt đầu: có thể đã xong hết, hoặc đang dừng giữa chừng (vd. chờ gate)
    const p = progress?.progress;
    if (p && p.total > 0 && p.done >= p.total) return t("done");
    if (p && p.done > 0) return t("resume");
    return t("notStarted");
  }
  return tStep(stepId, locale);
}

/**
 * Mode 1 (UC-14, UC-19): chưa import xong ⇒ trạng thái import; đã có baseline ⇒ số change request đang mở.
 * Trạng thái lấy từ `project.import_state` do BE trả.
 */
/** Hàm dịch của `app.projectCard.mode1`. */
export type Mode1Translator = (
  key: "notUploaded" | "importing" | "openCrs",
  values?: { state?: string; count?: number }
) => string;

export function mode1NextLabel(project: Project, t: Mode1Translator, openCrs?: number): string {
  const state = project.import_state;
  if (!state) return t("notUploaded");
  if (!IMPORT_DONE_STATUSES.includes(state)) return t("importing", { state: IMPORT_STATUS_LABELS[state] });
  if (openCrs === undefined) return IMPORT_STATUS_LABELS[state];
  return openCrs > 0 ? t("openCrs", { count: openCrs }) : IMPORT_STATUS_LABELS[state];
}

/** Nguồn mặc định (gần như mọi dự án) — không ghi nhãn trên card; chỉ nguồn khác mới hiện tên. */
const DEFAULT_SOURCE_MODE: ProjectMode = "fpt";

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
  progress,
  locale
}: {
  progress: ProgressResponse | null | undefined;
  locale: Locale;
}) {
  const t = useTranslations("app.projectCard");
  const { done, current } = phasePosition(progress);
  const label =
    current >= 0
      ? t("phaseOf", { current: current + 1, total: PHASES.length, phase: tPhase(PHASES[current], locale) })
      : done === PHASES.length
        ? t("allPhases", { total: PHASES.length })
        : t("notStarted");
  const width = (phases: number) => `${(phases / PHASES.length) * 100}%`;
  return (
    <div
      role="progressbar"
      aria-label={t("progressLabel")}
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
  openCrs,
  onRename,
  onDelete,
  onHardDelete,
  onMoveToFolder,
  folderName,
  draggable = false,
  selectable = false,
  selected = false,
  onToggleSelect
}: Props) {
  const t = useTranslations("app.projectCard");
  const tTime = useTranslations("app.time");
  const tMode = useTranslations("app.sourceMode");
  const tNext = useTranslations("app.projectCard.next");
  const tMode1 = useTranslations("app.projectCard.mode1");
  const status = getStatusBadge(progress);
  const mode = getSourceModeOption(project.mode);
  const archived = project.status === "archived";

  const menuItems: DropdownMenuItem[] = [
    { label: t("menu.rename"), icon: "pencil", onSelect: () => onRename(project) },
    ...(onMoveToFolder
      ? [
          {
            label: t("menu.moveToFolder"),
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
            label: t("menu.archive"),
            icon: "archive",
            onSelect: () => onDelete(project)
          } as const
        ]),
    {
      label: t("menu.hardDelete"),
      icon: "trash",
      tone: "danger",
      onSelect: () => onHardDelete(project)
    }
  ];

  return (
    <article
      data-mode={project.mode}
      draggable={(draggable && !selectable) || undefined}
      onDragStart={
        draggable && !selectable
          ? (e) => {
              e.dataTransfer.setData(PROJECT_DRAG_TYPE, project._id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      // Nền phẳng tím nhạt như thẻ thư mục (đổi màu này thì đổi cả màu chữ/rãnh tiến độ — xem PhaseBar), không viền, không bóng; hover ngả tím nhạt.
      // Đang mở menu ⋮ ⇒ nâng cả card (z-21 > nút ⋮ z-20 của card khác, < tiêu đề mục dính z-25), để menu không bị nút ⋮ của card bên dưới đè lên
      className={`relative flex flex-col rounded-card transition-colors duration-200 has-[[aria-expanded=true]]:z-[21] ${
        selected ? "bg-primary-soft" : "bg-surface-card hover:bg-surface-card-hover"
      } ${draggable && !selectable ? "cursor-grab active:cursor-grabbing" : ""}`}>
      <Link
        href={`/projects/${project._id}`}
        // Kéo cả card chứ không kéo URL của link
        draggable={false}
        onClick={selectable ? (e) => { e.preventDefault(); onToggleSelect?.(project); } : undefined}
        // Thứ bậc: tên (đậm, đậm màu nhất) → meta nhạt → tiến độ ở đáy. Chỉ tên được in đậm để mắt biết đọc gì trước.
        className="flex flex-col flex-1 min-h-[156px] rounded-card p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <h3 className="pr-8 text-[15px] font-semibold text-on-card leading-[1.4] line-clamp-2">{project.name}</h3>

        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-on-card-variant">
          <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status.tone]}`} />
          <span className="shrink-0 whitespace-nowrap">{t(`status.${status.key}`)}</span>
          <Dot />
          <span className="shrink-0 whitespace-nowrap">{timeAgo(project.updatedAt, tTime as TimeTranslator)}</span>
          {/* Thư mục nằm trong dòng meta, không thêm hàng riêng (chỉ vài card có ⇒ làm lệch hàng) */}
          {folderName && (
            <>
              <Dot />
              <span className="min-w-0 inline-flex items-center gap-1" title={t("folderTitle", { name: folderName })}>
                <Icon name="folder" size={12} className="shrink-0" />
                <span className="truncate">{folderName}</span>
              </span>
            </>
          )}
          {/* So theo nguồn đã phân giải: dự án thiếu `mode` (BE có lúc không trả) được coi là mặc định */}
          {mode.value !== DEFAULT_SOURCE_MODE && (
            <>
              <Dot />
              <span title={tMode(`${mode.key}.label`)} className="min-w-0 truncate">
                {tMode(`${mode.key}.shortLabel`)}
              </span>
            </>
          )}
          {archived && (
            <>
              <Dot />
              <span className="shrink-0 whitespace-nowrap">{t("archived")}</span>
            </>
          )}
        </div>

        {/* Đáy card: bước tiếp theo, rồi một hàng [thanh tiến độ | số bước] */}
        <div className="mt-auto pt-6 flex flex-col gap-2">
          {/* Khác hẳn dòng meta (nhạt, thường): đậm vừa, màu đậm, mũi tên tím = "việc tiếp theo" */}
          <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] font-medium text-on-card-strong">
            <Icon name="arrow-right" size={13} className="shrink-0 text-primary" />
            <span className="truncate">
              {project.mode === "import"
                ? mode1NextLabel(project, tMode1 as Mode1Translator, openCrs)
                : nextStepLabel(progress, tNext as NextTranslator, locale)}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <PhaseBar progress={progress} locale={locale} />
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
        {selectable ? (
          <label className="flex items-center justify-center size-8 rounded-full cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              onChange={() => onToggleSelect?.(project)}
              aria-label={t("select", { name: project.name })}
            />
            <span
              aria-hidden
              className={`w-[18px] h-[18px] rounded-[6px] flex items-center justify-center ${
                selected ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-transparent"
              }`}
            >
              <Icon name="check" size={11} />
            </span>
          </label>
        ) : (
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="pill"
              label={t("options", { name: project.name })}
              // Nền trắng; hover không đổi màu mà chỉ phóng nhẹ. `!` để thắng hover xám + transition-colors mặc định của IconButton
              className="bg-surface-container-lowest text-on-card-variant! hover:bg-surface-container-lowest! hover:text-on-card-variant! transition-transform! duration-150 hover:scale-110 active:scale-100"
            />
          )}
        />
        )}
      </div>
    </article>
  );
}
