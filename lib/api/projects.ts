import type { CreateProjectRequest, DocumentLanguage, ErdNotation, Project, ProjectMode, ProjectStatus } from "@/types/project";
import { apiCall } from "./client";
import type { ListPage } from "@/lib/hooks/use-infinite-list";

export const listProjects = (status?: ProjectStatus) =>
  apiCall<Project[]>(status ? `/projects?status=${status}` : "/projects");

/** Thứ tự danh sách: tạo mới nhất (lưới) · sửa gần nhất · mở gần nhất (chưa mở xếp cuối). */
export type ProjectListSort = "created" | "updated" | "opened";

export interface ListProjectsPageParams {
  page: number;
  limit: number;
  status?: ProjectStatus;
  mode?: ProjectMode;
  /** BE tìm tên không phân biệt dấu. */
  q?: string;
  sort?: ProjectListSort;
  /** Id thư mục, hoặc `none` = dự án ngoài thư mục; bỏ trống = mọi dự án. */
  folder?: string;
}

/** Một trang dự án (FLF-404): lọc / tìm / sắp xếp ở BE. Không truyền `page` thì dùng `listProjects` (mảng đầy đủ). */
export async function listProjectsPage(params: ListProjectsPageParams): Promise<ListPage<Project>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const res = await apiCall<Project[]>(`/projects?${query}`);
  const items = res.data ?? [];
  return { items, meta: (res.meta as unknown as ListPage<Project>["meta"]) ?? { page: params.page, limit: params.limit, total: items.length, totalPages: 1 } };
}

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
