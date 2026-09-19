import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";
import ProjectCard from "./ProjectCard";

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5";
const SKELETON_COUNT = 6;

interface ProjectGridProps {
  projects: readonly Project[];
  progressById: Record<string, ProgressResponse | null | undefined>;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
}

/** Lưới card dự án responsive 1/2/3/4 cột. */
export default function ProjectGrid({ projects, progressById, onRename, onDelete, onHardDelete }: ProjectGridProps) {
  return (
    <div className={GRID}>
      {projects.map((p) => (
        <ProjectCard
          key={p._id}
          project={p}
          progress={progressById[p._id]}
          onRename={onRename}
          onDelete={onDelete}
          onHardDelete={onHardDelete}
        />
      ))}
    </div>
  );
}

/** Giữ chỗ lúc tải — cùng lưới với card thật để không nhảy bố cục. */
export function ProjectGridSkeleton() {
  return (
    <div className={GRID} aria-busy="true" aria-label="Đang tải danh sách dự án">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <Card key={i} className="overflow-hidden" data-testid="project-skeleton">
          <Skeleton className="h-16 rounded-none" />
          <div className="flex flex-col gap-2.5 p-4">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
