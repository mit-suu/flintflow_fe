import { useTranslations } from "next-intl";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import type { Project } from "@/types/project";
import { SIDEBAR_ROW, SIDEBAR_ROW_IDLE } from "./SidebarNavItem";

interface RecentProjectsProps {
  projects: readonly Project[];
  onNavigate?: () => void;
}

/** Nhóm "Gần đây" của sidebar — icon tài liệu nhạt + tên (không chấm màu); rỗng thì không render. */
export default function RecentProjects({ projects, onNavigate }: RecentProjectsProps) {
  const t = useTranslations("app.shell");
  if (projects.length === 0) return null;
  return (
    <nav aria-label={t("recentNav")} className="flex flex-col gap-0.5">
      <div className="px-3 pb-1 text-[11.5px] font-medium text-on-surface-muted">{t("recentTitle")}</div>
      {projects.map((project) => (
        <Link
          key={project._id}
          href={`/projects/${project._id}`}
          onClick={onNavigate}
          className={`${SIDEBAR_ROW} ${SIDEBAR_ROW_IDLE} h-9 px-3 text-[12.5px]`}
        >
          <Icon name="file" size={16} className="text-on-surface-subtle" />
          <span className="truncate">{project.name}</span>
        </Link>
      ))}
    </nav>
  );
}
