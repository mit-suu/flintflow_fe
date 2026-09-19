import type { Project, ProjectMode, ProjectStatus } from "@/types/project";
import { apiCall } from "./client";

export const listProjects = (status?: ProjectStatus) =>
  apiCall<Project[]>(status ? `/projects?status=${status}` : "/projects");

export const getProject = (projectId: string) => apiCall<Project>(`/projects/${projectId}`);

/** `mode` bỏ trống ⇒ BE mặc định `fpt` (mode 2). */
export const createProject = (name: string, mode?: ProjectMode) =>
  apiCall<Project>("/projects", { method: "POST", body: JSON.stringify(mode ? { name, mode } : { name }) });

export const renameProject = (projectId: string, name: string) =>
  apiCall<Project>(`/projects/${projectId}/name`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

/** Mặc định lưu trữ (archive); `hard: true` xoá vĩnh viễn. */
export const deleteProject = (projectId: string, { hard = false }: { hard?: boolean } = {}) =>
  apiCall<null>(`/projects/${projectId}${hard ? "?hard=true" : ""}`, { method: "DELETE" });
