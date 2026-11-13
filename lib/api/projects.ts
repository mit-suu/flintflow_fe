import type {
  CreateProjectRequest,
  DocumentLanguage,
  ErdNotation,
  Project,
  ProjectMode,
  ProjectStatus,
  ScreenMockupEstimate,
  ScreenMockupMode,
  ScreenMockupRunView,
  ScreenMockupScope,
  ScreenMockupSummary,
  ScreenTheme,
} from "@/types/project";
import { apiCall, authFetch, ApiClientError } from "./client";

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

/**
 * Đổi theme mockup màn (FLF-410) — gửi field nào đổi field đó; `null` = về mặc định. Chỉ Lead/Analyst. Mockup đã vẽ được BE
 * vẽ lại từ spec đã lưu (không gọi AI, không trừ credit).
 */
export const setScreenTheme = (projectId: string, patch: Partial<ScreenTheme>) =>
  apiCall<Project>(`/projects/${projectId}/screen-theme`, { method: "PATCH", body: JSON.stringify(patch) });

/** FLF-410: màn có ảnh gốc (dự án import) + mục chứa ảnh + trạng thái mockup. */
export const getScreenMockupSummary = (projectId: string) => apiCall<ScreenMockupSummary>(`/projects/${projectId}/screen-mockups`);

/** FLF-410: số lượt AI + credit dự tính để vẽ lại (màn đã đúng kiểu không tính). Không gọi model. */
export const estimateScreenMockups = (projectId: string, mode: ScreenMockupMode, scope: ScreenMockupScope, screenId?: string) => {
  const query = new URLSearchParams({ mode, scope, ...(screenId ? { screen_id: screenId } : {}) });
  return apiCall<ScreenMockupEstimate>(`/projects/${projectId}/screen-mockups?${query.toString()}`);
};

/**
 * FLF-410: bắt đầu lượt vẽ lại ảnh gốc bằng mockup chạy nền (202, trả tiến độ ban đầu). Ví thiếu ⇒ 402 `INSUFFICIENT_CREDITS`
 * (`meta.required` / `meta.available`), không vẽ màn nào; đang có lượt chạy ⇒ 409 `SCREEN_MOCKUP_RUNNING`.
 */
export const runScreenMockups = (projectId: string, mode: ScreenMockupMode, scope: ScreenMockupScope, screenIds?: readonly string[]) =>
  apiCall<ScreenMockupRunView>(`/projects/${projectId}/screen-mockups`, {
    method: "POST",
    body: JSON.stringify({ mode, scope, ...(screenIds?.length ? { screen_ids: screenIds } : {}) }),
  });

/** FLF-410: dùng lại ảnh gốc (giữ hình đã vẽ để bật lại không tốn credit). */
export const disableScreenMockups = (projectId: string, scope: ScreenMockupScope, screenId?: string) =>
  apiCall<{ disabled: string[] }>(`/projects/${projectId}/screen-mockups`, {
    method: "DELETE",
    body: JSON.stringify({ scope, ...(screenId ? { screen_id: screenId } : {}) }),
  });

/** FLF-410: tiến độ lượt vẽ mockup gần nhất; chưa từng chạy ⇒ `data = null`. */
export const getScreenMockupRun = (projectId: string) => apiCall<ScreenMockupRunView | null>(`/projects/${projectId}/screen-mockups/run`);

/** FLF-410: dừng lượt đang chạy — màn đang vẽ vẽ nốt, màn còn lại không vẽ, không trừ credit. */
export const cancelScreenMockupRun = (projectId: string) =>
  apiCall<ScreenMockupRunView | null>(`/projects/${projectId}/screen-mockups/run/cancel`, { method: "POST" });

/** FLF-410: ảnh gốc của màn (hình minh hoạ cho kiểu "Theo bố cục ảnh gốc"). Không có / EMF ⇒ ném `ApiClientError` 404. */
export const fetchScreenOriginalImage = async (projectId: string, screenId: string): Promise<Blob> => {
  const res = await authFetch(`/projects/${projectId}/screen-mockups/${encodeURIComponent(screenId)}/original`);
  if (!res.ok) throw new ApiClientError(res.status, "SCREEN_HAS_NO_ORIGINAL", "No original picture");
  return res.blob();
};
