import { useTranslations } from "next-intl";
import Skeleton from "@/components/ui/Skeleton";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";
import ProjectCard from "./ProjectCard";

/** Lưới dùng chung cho thư mục, dự án và skeleton — cùng cột để không nhảy bố cục. */
export const CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5";
const SKELETON_COUNT = 6;

interface ProjectGridProps {
  projects: readonly Project[];
  progressById: Record<string, ProgressResponse | null | undefined>;
  /** Mode 1: số change request đang mở theo id dự án. */
  openCrsById?: Record<string, number>;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
  onMoveToFolder?: (p: Project) => void;
  /** Card kéo được vào thẻ thư mục. */
  draggable?: boolean;
  /** Tên thư mục của dự án (chip trên card) — chỉ truyền ở nơi hiện cả dự án trong thư mục. */
  folderNameOf?: (p: Project) => string | null;
}

/** Lưới card dự án responsive 1/2/3/4 cột (4 cột từ màn desktop xl). */
export default function ProjectGrid({
  projects,
  progressById,
  openCrsById,
  onRename,
  onDelete,
  onHardDelete,
  onMoveToFolder,
  draggable,
  folderNameOf,
}: ProjectGridProps) {
  return (
    <div className={CARD_GRID}>
      {projects.map((p) => (
        <ProjectCard
          key={p._id}
          project={p}
          progress={progressById[p._id]}
          openCrs={openCrsById?.[p._id]}
          onRename={onRename}
          onDelete={onDelete}
          onHardDelete={onHardDelete}
          onMoveToFolder={onMoveToFolder}
          draggable={draggable}
          folderName={folderNameOf?.(p)}
        />
      ))}
    </div>
  );
}

/** Giữ chỗ lúc tải — cùng hình với card thật (bìa + thân). */
export function ProjectGridSkeleton() {
  const t = useTranslations("app.projectCard");
  return (
    <div className={CARD_GRID} aria-busy="true" aria-label={t("gridLoading")}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} data-testid="project-skeleton" className="rounded-card overflow-hidden bg-surface-container-lowest border border-outline-variant">
          <Skeleton className="h-[72px] rounded-none" />
          <div className="flex flex-col gap-2.5 p-5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
