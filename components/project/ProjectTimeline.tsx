import type { ComponentProps } from "react";
import CountBadge from "@/components/ui/CountBadge";
import { groupByRecency } from "@/lib/group-by-recency";
import type { Project } from "@/types/project";
import ProjectGrid from "./ProjectGrid";

export type ProjectSort = "updated" | "opened";

type GridProps = Omit<ComponentProps<typeof ProjectGrid>, "projects">;

interface ProjectTimelineProps extends GridProps {
  projects: readonly Project[];
  sortBy: ProjectSort;
}

/** Tab "Dự án": mọi dự án chia vùng Hôm nay · 7 ngày · 30 ngày · Cũ hơn theo mốc cập nhật hoặc mốc mở gần nhất. */
export default function ProjectTimeline({
  projects,
  sortBy,
  ...gridProps
}: ProjectTimelineProps) {
  const groups = groupByRecency(projects, (p) =>
    sortBy === "opened" ? p.lastOpenedAt : p.updatedAt
  );
  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <section
          key={group.bucket}
          aria-labelledby={`recency-${group.bucket}`}
          className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3
              id={`recency-${group.bucket}`}
              className="text-[13px] font-bold tracking-[0.06em] text-on-surface-muted">
              {group.label}
            </h3>
            <CountBadge
              count={group.items.length}
              max={999}
            />
          </div>
          <ProjectGrid
            projects={group.items}
            {...gridProps}
          />
        </section>
      ))}
    </div>
  );
}
