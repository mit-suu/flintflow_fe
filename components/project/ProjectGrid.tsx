import Skeleton from "@/components/ui/Skeleton";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";
import ProjectCard from "./ProjectCard";

/** Lưới dùng chung cho thư mục, dự án và skeleton — cùng cột để không nhảy bố cục. */
export const CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5";
const SKELETON_COUNT = 6;

interface ProjectGridProps {
  projects: readonly Project[];
  progressById: Record<string, ProgressResponse | null | undefined>;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
  onMoveToFolder?: (p: Project) => void;
}

/** Lưới card dự án responsive 1/2/3/4 cột. */
export default function ProjectGrid({ projects, progressById, onRename, onDelete, onHardDelete, onMoveToFolder }: ProjectGridProps) {
  return (
    <div className={CARD_GRID}>
      {projects.map((p) => (
        <ProjectCard
          key={p._id}
          project={p}
          progress={progressById[p._id]}
          onRename={onRename}
          onDelete={onDelete}
          onHardDelete={onHardDelete}
          onMoveToFolder={onMoveToFolder}
        />
      ))}
    </div>
  );
}

/** Giữ chỗ lúc tải — cùng hình với card thật (bìa + thân). */
export function ProjectGridSkeleton() {
  return (
    <div className={CARD_GRID} aria-busy="true" aria-label="Đang tải danh sách dự án">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} data-testid="project-skeleton" className="rounded-[22px] overflow-hidden bg-surface-container-lowest">
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
