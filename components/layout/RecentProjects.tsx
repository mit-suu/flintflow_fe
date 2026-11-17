import { useTranslations } from "next-intl";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import type { Project } from "@/types/project";
import { SIDEBAR_ROW, SIDEBAR_ROW_IDLE } from "./SidebarNavItem";

interface RecentProjectsProps {
  projects: readonly Project[];
  onNavigate?: () => void;
  /** Danh sách đang tải lần đầu ⇒ giữ chỗ nhóm (tiêu đề + icon thật, tên là thanh giữ chỗ) thay vì chen vào sau. */
  loading?: boolean;
}

/** Nhóm "Gần đây" của sidebar — icon tài liệu nhạt + tên (không chấm màu); rỗng thì không render. */
export default function RecentProjects({ projects, onNavigate, loading = false }: RecentProjectsProps) {
  const t = useTranslations("app.shell");
  if (loading && projects.length === 0) {
    return (
      <nav aria-label={t("recentNav")} aria-busy="true" className="flex flex-col gap-0.5">
        <div className="px-3 pb-1 text-body font-medium text-on-surface-muted">{t("recentTitle")}</div>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden className={`${SIDEBAR_ROW} h-9 px-3`}>
            <Icon name="file" size={16} className="text-on-surface-subtle" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </nav>
    );
  }
  if (projects.length === 0) return null;
  return (
    <nav aria-label={t("recentNav")} className="flex flex-col gap-0.5">
      <div className="px-3 pb-1 text-body font-medium text-on-surface-muted">{t("recentTitle")}</div>
      {projects.map((project) => (
        <Link
          key={project._id}
          href={`/projects/${project._id}`}
          onClick={onNavigate}
          className={`${SIDEBAR_ROW} ${SIDEBAR_ROW_IDLE} h-9 px-3 text-body`}
        >
          <Icon name="file" size={16} className="text-on-surface-subtle" />
          <span className="truncate">{project.name}</span>
        </Link>
      ))}
    </nav>
  );
}
