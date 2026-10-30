/**
 * Mẫu và thư viện nội dung cấp tổ chức (FLF-278 trên FLF-335/336, `import-change-contract.md` §FLF-278). Route tổ chức kiểm membership
 * theo `:orgId`; route dự án đi qua chuỗi guard của `/projects`. Lỗi giữ nguyên `code` qua `ApiClientError`.
 */
import type { ContentEntry, ContentEntryInput, LibraryMatch, OrgTemplateSummary } from "@/types/org-library";
import type { ImportedDocument } from "@/types/import";
import type { TemplateIntent } from "@/types/project";
import { apiCall } from "./client";

const unwrap = <T>(res: { data: T | null }): T => {
  if (res.data === null) throw new Error("Empty org library response");
  return res.data;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const listOrgTemplates = async (orgId: string): Promise<OrgTemplateSummary[]> =>
  unwrap(await apiCall<OrgTemplateSummary[]>(`/orgs/${orgId}/templates`));
export const deleteOrgTemplate = async (orgId: string, templateId: string): Promise<void> => {
  await apiCall(`/orgs/${orgId}/templates/${templateId}`, json("DELETE"));
};

export const listContentLibrary = async (orgId: string): Promise<ContentEntry[]> =>
  unwrap(await apiCall<ContentEntry[]>(`/orgs/${orgId}/content-library`));
export const upsertContentEntry = async (orgId: string, input: ContentEntryInput): Promise<ContentEntry> =>
  unwrap(await apiCall<ContentEntry>(`/orgs/${orgId}/content-library`, json("POST", input)));
export const updateContentEntry = async (orgId: string, entryId: string, input: Partial<ContentEntryInput>): Promise<ContentEntry> =>
  unwrap(await apiCall<ContentEntry>(`/orgs/${orgId}/content-library/${entryId}`, json("PATCH", input)));
export const deleteContentEntry = async (orgId: string, entryId: string): Promise<void> => {
  await apiCall(`/orgs/${orgId}/content-library/${entryId}`, json("DELETE"));
};

const project = (projectId: string) => `/projects/${projectId}`;

/** Dự án dùng mẫu đã lưu của tổ chức: import từ chính file mẫu, mapping heading áp sẵn (bỏ bước xác nhận). */
export const importFromOrgTemplate = async (projectId: string, orgTemplateId: string, intent?: TemplateIntent): Promise<{ import: ImportedDocument }> =>
  unwrap(await apiCall<{ import: ImportedDocument }>(`${project(projectId)}/import/from-org`, json("POST", { org_template_id: orgTemplateId, ...(intent ? { intent } : {}) })));
/** Lưu file mẫu + mapping đã xác nhận của lần import gần nhất làm mẫu của tổ chức. */
export const saveImportToOrg = async (projectId: string, name: string): Promise<OrgTemplateSummary> =>
  unwrap(await apiCall<OrgTemplateSummary>(`${project(projectId)}/import/save-to-org`, json("POST", { name })));
export const libraryMatches = async (projectId: string): Promise<LibraryMatch[]> => unwrap(await apiCall<LibraryMatch[]>(`${project(projectId)}/library-matches`));
export const saveSectionToLibrary = async (projectId: string, customSectionId: string): Promise<ContentEntry> =>
  unwrap(await apiCall<ContentEntry>(`${project(projectId)}/library`, json("POST", { custom_section_id: customSectionId })));
