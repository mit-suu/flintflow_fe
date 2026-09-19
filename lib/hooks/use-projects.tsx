"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listProjects } from "@/lib/api/projects";
import type { Project } from "@/types/project";

interface ProjectsContextValue {
  /** Mọi dự án của user (cả đang làm và lưu trữ) — dashboard lọc trạng thái trên danh sách này. */
  projects: Project[];
  loading: boolean;
  error: string | null;
  /** Tải lại sau khi tạo / đổi tên / lưu trữ / xoá; sidebar và dashboard cùng cập nhật. */
  reload: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const RECENT_LIMIT = 3;

/** 3 dự án đang làm sửa gần nhất (sidebar "Gần đây"). */
export const selectRecentProjects = (projects: readonly Project[], limit = RECENT_LIMIT): Project[] =>
  [...projects]
    .filter((p) => p.status === "active")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

/**
 * Tải `GET /projects` một lần cho cả khung `/home/*` để sidebar ("Gần đây") và dashboard không gọi hai lần.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // setState chỉ nằm trong callback của promise ⇒ effect gọi hàm này không set state đồng bộ
  const fetchProjects = useCallback(
    () =>
      listProjects()
        .then((res) => {
          setProjects(res.data ?? []);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không thể tải danh sách dự án"))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const reload = useCallback(async () => {
    setLoading(true);
    await fetchProjects();
  }, [fetchProjects]);

  const value = useMemo(() => ({ projects, loading, error, reload }), [projects, loading, error, reload]);
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects phải nằm trong <ProjectsProvider> (app/home/layout.tsx)");
  return ctx;
}
