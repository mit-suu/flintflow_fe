import Link from "next/link";
import type { Project } from "@/types/project";
import { getSourceModeOption } from "@/lib/project-source-mode";

const DOT: Record<string, string> = {
  info: "bg-info",
  warning: "bg-accent-gold",
  primary: "bg-primary",
};

interface RecentProjectsProps {
  projects: readonly Project[];
  onNavigate?: () => void;
}

/** Nhóm "Gần đây" của sidebar — chấm màu theo source mode; rỗng thì không render. */
export default function RecentProjects({ projects, onNavigate }: RecentProjectsProps) {
  if (projects.length === 0) return null;
  return (
    <nav aria-label="Dự án gần đây" className="flex flex-col gap-0.5">
      <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-on-surface-subtle">
        Gần đây
      </div>
      {projects.map((project) => (
        <Link
          key={project._id}
          href={`/projects/${project._id}`}
          onClick={onNavigate}
          className="flex items-center gap-2.5 h-8 px-2.5 rounded-[9px] text-[12px] font-semibold text-on-surface-dark hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span aria-hidden className={`w-2 h-2 rounded-full shrink-0 ${DOT[getSourceModeOption(project.sourceMode).tone]}`} />
          <span className="truncate">{project.name}</span>
        </Link>
      ))}
    </nav>
  );
}
