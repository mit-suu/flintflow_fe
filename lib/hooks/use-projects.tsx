"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listFolders } from "@/lib/api/folders";
import { listProjectsPage } from "@/lib/api/projects";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";

interface ProjectsContextValue {
  /** 3 dự án đang làm sửa gần nhất (sidebar "Gần đây") — BE sắp sẵn. */
  recentProjects: Project[];
  /** Số dự án đang làm của org (badge tab "Dự án"). */
  activeCount: number;
  /** Org có ít nhất một dự án (kể cả lưu trữ) — chưa có dự án lẫn thư mục thì dashboard hiện màn bắt đầu. */
  hasProjects: boolean;
  /** Thư mục của org, kèm `projectCount` do BE đếm. */
  folders: Folder[];
  loading: boolean;
  /** Lỗi tải dự án (chặn dashboard). */
  error: string | null;
  /** Lỗi tải thư mục — riêng, để dự án vẫn hiện bình thường. */
  foldersError: string | null;
  /** Tải lại tóm tắt dự án lẫn thư mục (số dự án trong thư mục phụ thuộc thao tác trên dự án). */
  reload: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const RECENT_LIMIT = 3;

const messageOf = (err: unknown, fallback: string) => userErrorMessage(err, fallback);

/**
 * Lỗi FE tự sinh lưu dạng mã `@<key>` (mẫu `lib/hook-errors.ts`): ghi trong callback của effect nên không gọi
 * `useTranslations` ở đây; component dịch lúc render với `useTranslations("app.home.loadErrors")`.
 */
export type ProjectsLoadErrorKey = "projectsLoadFailed" | "foldersLoadFailed";

export const projectsErrorText = (error: string, t: (key: ProjectsLoadErrorKey) => string): string =>
  error === "@projectsLoadFailed" || error === "@foldersLoadFailed" ? t(error.slice(1) as ProjectsLoadErrorKey) : error;

/**
 * Tóm tắt dự án + thư mục cho cả khung `/home/*` (sidebar "Gần đây", badge tab, màn bắt đầu của dashboard). Không tải mọi
 * dự án (FLF-404): danh sách dài của dashboard tự tải theo trang. Hai lời gọi trang nhỏ:
 * 3 dự án đang làm sửa gần nhất (kèm tổng đang làm) và 1 dự án bất kỳ (chỉ để biết org đã có dự án chưa).
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [hasProjects, setHasProjects] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // setState chỉ nằm trong callback của promise ⇒ effect gọi hàm này không set state đồng bộ
  const fetchAll = useCallback(
    () =>
      Promise.allSettled([
        Promise.all([
          listProjectsPage({ page: 1, limit: RECENT_LIMIT, status: "active", sort: "updated" }),
          listProjectsPage({ page: 1, limit: 1 }),
        ]),
        listFolders(),
      ])
        .then(([projectsRes, foldersRes]) => {
          if (projectsRes.status === "fulfilled") {
            const [recent, any] = projectsRes.value;
            setRecentProjects(recent.items);
            setActiveCount(recent.meta.total);
            setHasProjects(any.meta.total > 0);
          }
          if (foldersRes.status === "fulfilled") setFolders(foldersRes.value.data ?? []);
          setError(projectsRes.status === "rejected" ? messageOf(projectsRes.reason, "@projectsLoadFailed") : null);
          setFoldersError(foldersRes.status === "rejected" ? messageOf(foldersRes.reason, "@foldersLoadFailed") : null);
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
    () => ({ recentProjects, activeCount, hasProjects, folders, loading, error, foldersError, reload }),
    [recentProjects, activeCount, hasProjects, folders, loading, error, foldersError, reload]
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects phải nằm trong <ProjectsProvider> (app/home/layout.tsx)");
  return ctx;
}
