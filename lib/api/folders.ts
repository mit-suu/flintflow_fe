import type { Folder, FolderColor } from "@/types/folder";
import { apiCall } from "./client";

export const listFolders = () => apiCall<Folder[]>("/folders");

export const createFolder = (body: { name: string; color: FolderColor }) =>
  apiCall<Folder>("/folders", { method: "POST", body: JSON.stringify(body) });

export const updateFolder = (folderId: string, body: { name?: string; color?: FolderColor }) =>
  apiCall<Folder>(`/folders/${folderId}`, { method: "PATCH", body: JSON.stringify(body) });

/** Xoá thư mục; dự án bên trong được BE giữ lại và đưa ra ngoài thư mục. */
export const deleteFolder = (folderId: string) =>
  apiCall<{ _id: string; releasedProjects: number }>(`/folders/${folderId}`, { method: "DELETE" });
