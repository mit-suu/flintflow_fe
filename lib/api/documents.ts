import type { ProjectDocument } from "@/types/document";
import { apiCall } from "./client";

export const listProjectDocuments = (projectId: string) =>
  apiCall<ProjectDocument[]>(`/projects/${projectId}/documents`);

export const uploadProjectDocument = (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiCall<ProjectDocument>(`/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
};

export const deleteProjectDocument = (projectId: string, documentId: string) =>
  apiCall<{ deleted: boolean }>(`/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
  });
