"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listFolders } from "@/lib/api/folders";
import { listProjects } from "@/lib/api/projects";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";

interface ProjectsContextValue {
  /** Mọi dự án của user (cả đang làm và lưu trữ) — dashboard lọc trạng thái trên danh sách này. */
  projects: Project[];
  /** Thư mục của user, kèm `projectCount` do BE đếm. */
  folders: Folder[];
  loading: boolean;
  /** Lỗi tải dự án (chặn dashboard). */
  error: string | null;
  /** Lỗi tải thư mục — riêng, để dự án vẫn hiện bình thường. */
  foldersError: string | null;
  /** Tải lại cả dự án lẫn thư mục (số dự án trong thư mục phụ thuộc thao tác trên dự án). */
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

const messageOf = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * Tải `GET /projects` + `GET /folders` một lần cho cả khung `/home/*` để sidebar ("Gần đây") và dashboard
 * không gọi lặp.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // setState chỉ nằm trong callback của promise ⇒ effect gọi hàm này không set state đồng bộ
  const fetchAll = useCallback(
    () =>
      Promise.allSettled([listProjects(), listFolders()])
        .then(([projectsRes, foldersRes]) => {
          if (projectsRes.status === "fulfilled") setProjects(projectsRes.value.data ?? []);
          if (foldersRes.status === "fulfilled") setFolders(foldersRes.value.data ?? []);
          setError(projectsRes.status === "rejected" ? messageOf(projectsRes.reason, "Không thể tải danh sách dự án") : null);
          setFoldersError(foldersRes.status === "rejected" ? messageOf(foldersRes.reason, "Không thể tải thư mục") : null);
        })
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const reload = useCallback(async () => {
    setLoading(true);
    await fetchAll();
  }, [fetchAll]);

  const value = useMemo(
    () => ({ projects, folders, loading, error, foldersError, reload }),
    [projects, folders, loading, error, foldersError, reload]
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects phải nằm trong <ProjectsProvider> (app/home/layout.tsx)");
  return ctx;
}
