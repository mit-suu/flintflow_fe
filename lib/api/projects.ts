import type { CreateProjectRequest, DocumentLanguage, ErdNotation, Project, ProjectMode, ProjectStatus } from "@/types/project";
import { apiCall } from "./client";

export const listProjects = (status?: ProjectStatus) =>
  apiCall<Project[]>(status ? `/projects?status=${status}` : "/projects");

export const getProject = (projectId: string) => apiCall<Project>(`/projects/${projectId}`);

/**
 * `mode` bỏ trống ⇒ BE mặc định `fpt` (mode 2); `folderId` ⇒ tạo thẳng trong thư mục (BE kiểm thư mục thuộc user);
 * `documentLanguage` bỏ trống ⇒ BE lấy ngôn ngữ tài khoản (FLF-265).
 */
export const createProject = (name: string, mode?: ProjectMode, folderId?: string, documentLanguage?: DocumentLanguage) =>
  apiCall<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      ...(mode ? { mode } : {}),
      ...(folderId ? { folderId } : {}),
      ...(documentLanguage ? { documentLanguage } : {}),
    }),
  });

/**
 * FLF-335: tạo theo lựa chọn "Dự án mới / Dự án có sẵn" — BE suy ra `mode` (mới không mẫu ⇒ `fpt`; mới có mẫu bắt buộc hoặc
 * có sẵn ⇒ `import`). `documentLanguage` chỉ với dự án mới; dự án có sẵn theo file.
 */
export const createProjectFrom = (request: CreateProjectRequest) =>
  apiCall<Project>("/projects", { method: "POST", body: JSON.stringify(request) });

export const renameProject = (projectId: string, name: string) =>
  apiCall<Project>(`/projects/${projectId}/name`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

/** Mặc định lưu trữ (archive); `hard: true` xoá vĩnh viễn. */
export const deleteProject = (projectId: string, { hard = false }: { hard?: boolean } = {}) =>
  apiCall<null>(`/projects/${projectId}${hard ? "?hard=true" : ""}`, { method: "DELETE" });

/** Chuyển dự án vào thư mục; `null` ⇒ ra ngoài thư mục. */
export const moveProjectToFolder = (projectId: string, folderId: string | null) =>
  apiCall<Project>(`/projects/${projectId}/folder`, {
    method: "PATCH",
    body: JSON.stringify({ folderId }),
  });

/**
 * Đổi ngôn ngữ tài liệu (FLF-265) — chỉ Lead/Analyst; dự án tải file lên (mode `import`) ⇒ `409 DOCUMENT_LANGUAGE_LOCKED`.
 * Dự án tạo SRS đã chốt baseline (`converted_from = fpt`, FLF-318) vẫn đổi được.
 */
export const setDocumentLanguage = (projectId: string, documentLanguage: DocumentLanguage) =>
  apiCall<Project>(`/projects/${projectId}/document-language`, {
    method: "PATCH",
    body: JSON.stringify({ documentLanguage }),
  });

/**
 * Đổi ký pháp ERD của dự án (FLF-324) — chỉ Lead/Analyst (Viewer ⇒ 403). Khác ký pháp cũ và đã có hình ERD ⇒ BE vẽ lại
 * ngay (Spine version tăng một); mọi mode đều đổi được.
 */
export const setErdNotation = (projectId: string, erdNotation: ErdNotation) =>
  apiCall<Project>(`/projects/${projectId}/erd-notation`, {
    method: "PATCH",
    body: JSON.stringify({ erdNotation }),
  });
