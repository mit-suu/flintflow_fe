/**
 * Mẫu và thư viện nội dung cấp tổ chức (FLF-278 trên FLF-335/336, `import-change-contract.md` §FLF-278, §FLF-395). Route tổ chức kiểm
 * membership theo `:orgId`; route dự án đi qua chuỗi guard của `/projects`. Lỗi giữ nguyên `code` qua `ApiClientError`.
 */
import type {
  ContentEntry,
  ContentEntryInput,
  DeleteTemplateResult,
  HeadingEdit,
  LibraryMatch,
  OrgTemplateSummary,
  SkeletonDecision,
  SkeletonPending,
  TemplateVersionDetail,
} from "@/types/org-library";
import type { ImportedDocument } from "@/types/import";
import { apiCall } from "./client";

const unwrap = <T>(res: { data: T | null }): T => {
  if (res.data === null) throw new Error("Empty org library response");
  return res.data;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const listOrgTemplates = async (orgId: string): Promise<OrgTemplateSummary[]> =>
  unwrap(await apiCall<OrgTemplateSummary[]>(`/orgs/${orgId}/templates`));
/** Xoá cả họ mẫu cùng mọi bản — chỉ Lead. Trả số dự án đang theo mẫu để báo. */
export const deleteOrgTemplate = async (orgId: string, templateId: string): Promise<DeleteTemplateResult> =>
  unwrap(await apiCall<DeleteTemplateResult>(`/orgs/${orgId}/templates/${templateId}`, json("DELETE")));

const docxForm = (file: File, name?: string) => {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  return form;
};
/** Lead tải file: họ mẫu mới + bản 1 nháp (mapping tự nhận) — `name` bắt buộc. */
export const uploadOrgTemplate = async (orgId: string, name: string, file: File): Promise<TemplateVersionDetail> =>
  unwrap(await apiCall<TemplateVersionDetail>(`/orgs/${orgId}/templates`, { method: "POST", body: docxForm(file, name) }));
/** Lead tải file: bản nháp kế tiếp của họ mẫu có sẵn. */
export const uploadTemplateVersion = async (orgId: string, templateId: string, file: File): Promise<TemplateVersionDetail> =>
  unwrap(await apiCall<TemplateVersionDetail>(`/orgs/${orgId}/templates/${templateId}/versions`, { method: "POST", body: docxForm(file) }));
export const getTemplateVersion = async (orgId: string, templateId: string, version: number): Promise<TemplateVersionDetail> =>
  unwrap(await apiCall<TemplateVersionDetail>(`/orgs/${orgId}/templates/${templateId}/versions/${version}`));
/** Lead rà mapping (chỉ gửi các heading đã đổi section) rồi đăng bản nháp. */
export const publishTemplateVersion = async (orgId: string, templateId: string, version: number, headings: HeadingEdit[]): Promise<TemplateVersionDetail> =>
  unwrap(await apiCall<TemplateVersionDetail>(`/orgs/${orgId}/templates/${templateId}/versions/${version}/publish`, json("POST", { headings })));
export const deleteTemplateVersion = async (orgId: string, templateId: string, version: number): Promise<DeleteTemplateResult> =>
  unwrap(await apiCall<DeleteTemplateResult>(`/orgs/${orgId}/templates/${templateId}/versions/${version}`, json("DELETE")));

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

/**
 * Dự án dùng mẫu đã lưu của tổ chức: import từ chính file mẫu, mapping heading áp sẵn (bỏ bước xác nhận). `version` trống ⇒ BE lấy
 * bản đã đăng mới nhất. Ý định với file BE lấy từ dự án (hộp Tạo dự án).
 */
export const importFromOrgTemplate = async (projectId: string, orgTemplateId: string, version?: number): Promise<{ import: ImportedDocument }> =>
  unwrap(
    await apiCall<{ import: ImportedDocument }>(
      `${project(projectId)}/import/from-org`,
      json("POST", { org_template_id: orgTemplateId, ...(version ? { version } : {}) })
    )
  );
/** Lưu file mẫu + mapping đã xác nhận của lần import gần nhất làm mẫu của tổ chức (chỉ Lead). */
export const saveImportToOrg = async (projectId: string, name: string): Promise<OrgTemplateSummary> =>
  unwrap(await apiCall<OrgTemplateSummary>(`${project(projectId)}/import/save-to-org`, json("POST", { name })));
export const libraryMatches = async (projectId: string): Promise<LibraryMatch[]> => unwrap(await apiCall<LibraryMatch[]>(`${project(projectId)}/library-matches`));
export const saveSectionToLibrary = async (projectId: string, customSectionId: string): Promise<ContentEntry> =>
  unwrap(await apiCall<ContentEntry>(`${project(projectId)}/library`, json("POST", { custom_section_id: customSectionId })));

/** Mục BA tự đặt của mẫu khung tự lưu; `null` = dự án không có khung riêng. */
export const getSkeletonPending = async (projectId: string): Promise<SkeletonPending | null> =>
  (await apiCall<SkeletonPending | null>(`${project(projectId)}/template-skeleton`)).data;
export const decideSkeletonPending = async (projectId: string, decisions: SkeletonDecision[]): Promise<SkeletonPending> =>
  unwrap(await apiCall<SkeletonPending>(`${project(projectId)}/template-skeleton/decisions`, json("POST", { decisions })));
/** Một lượt AI cho mọi mục còn chờ — tốn credit, chỉ gọi khi người dùng bấm. */
export const suggestSkeletonNames = async (projectId: string): Promise<SkeletonPending> =>
  unwrap(await apiCall<SkeletonPending>(`${project(projectId)}/template-skeleton/suggest`, json("POST")));
