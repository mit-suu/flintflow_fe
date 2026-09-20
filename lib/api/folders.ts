import type { Folder, FolderColor } from "@/types/folder";
import type { Project } from "@/types/project";
import { apiCall } from "./client";

export const listFolders = () => apiCall<Folder[]>("/folders");

export const createFolder = (body: { name: string; color: FolderColor }) =>
  apiCall<Folder>("/folders", { method: "POST", body: JSON.stringify(body) });

export const updateFolder = (folderId: string, body: { name?: string; color?: FolderColor }) =>
  apiCall<Folder>(`/folders/${folderId}`, { method: "PATCH", body: JSON.stringify(body) });

/** Xoá thư mục; dự án bên trong được BE giữ lại và đưa ra ngoài thư mục. */
export const deleteFolder = (folderId: string) =>
  apiCall<{ _id: string; releasedProjects: number }>(`/folders/${folderId}`, { method: "DELETE" });

/** Thêm nhiều dự án có sẵn vào thư mục trong một request; trả số dự án đã chuyển. */
export const addProjectsToFolder = (folderId: string, projectIds: string[]) =>
  apiCall<{ moved: number }>(`/folders/${folderId}/projects`, { method: "POST", body: JSON.stringify({ projectIds }) });

/** Đưa nhiều dự án đang trong thư mục ra ngoài thư mục trong một request; trả số dự án đã gỡ. */
export const removeProjectsFromFolder = (folderId: string, projectIds: string[]) =>
  apiCall<{ moved: number }>(`/folders/${folderId}/projects`, { method: "DELETE", body: JSON.stringify({ projectIds }) });

/**
 * Chuyển nhiều dự án tới cùng một đích. Vào một thư mục ⇒ một request. Ra ngoài thư mục ⇒ một request cho
 * mỗi thư mục nguồn (endpoint gỡ nhận folderId của nguồn); dự án vốn đã ở ngoài được bỏ qua.
 */
export const moveProjectsToFolder = async (projects: readonly Project[], folderId: string | null) => {
  const ids = projects.map((p) => p._id);
  if (folderId) return addProjectsToFolder(folderId, ids);

  const bySourceFolder = new Map<string, string[]>();
  for (const p of projects) {
    if (!p.folderId) continue;
    bySourceFolder.set(p.folderId, [...(bySourceFolder.get(p.folderId) ?? []), p._id]);
  }
  await Promise.all([...bySourceFolder].map(([source, sourceIds]) => removeProjectsFromFolder(source, sourceIds)));
};
