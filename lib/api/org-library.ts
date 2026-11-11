/**
 * Mẫu cấp tổ chức (FLF-278 trên FLF-335/336, `import-change-contract.md` §FLF-278). Route tổ chức kiểm membership
 * theo `:orgId`; route dự án đi qua chuỗi guard của `/projects`. Lỗi giữ nguyên `code` qua `ApiClientError`.
 */
import type { OrgTemplateSummary } from "@/types/org-library";
import type { ImportedDocument } from "@/types/import";
import { apiCall } from "./client";
import type { ListPage } from "@/lib/hooks/use-infinite-list";

const unwrap = <T>(res: { data: T | null }): T => {
  if (res.data === null) throw new Error("Empty org library response");
  return res.data;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const listOrgTemplates = async (orgId: string): Promise<OrgTemplateSummary[]> =>
  unwrap(await apiCall<OrgTemplateSummary[]>(`/orgs/${orgId}/templates`));
export type OrgTemplateSort = "uses" | "recent" | "name";
export interface OrgTemplatePageQuery {
  page: number;
  limit?: number;
  /** Tìm theo tên mẫu / tên file, không phân biệt dấu (BE). */
  q?: string;
  sort?: OrgTemplateSort;
}
/** Một trang của thư viện mẫu (trang Thư viện tải dần khi cuộn). Cần cả danh sách (ô chọn mẫu) thì dùng `listOrgTemplates`. */
export const listOrgTemplatesPage = async (orgId: string, query: OrgTemplatePageQuery): Promise<ListPage<OrgTemplateSummary>> => {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit ?? 20), sort: query.sort ?? "uses" });
  if (query.q) params.set("q", query.q);
  const res = await apiCall<OrgTemplateSummary[]>(`/orgs/${orgId}/templates?${params}`);
  return { items: unwrap(res), meta: res.meta as unknown as ListPage<OrgTemplateSummary>["meta"] };
};
export const deleteOrgTemplate = async (orgId: string, templateId: string): Promise<void> => {
  await apiCall(`/orgs/${orgId}/templates/${templateId}`, json("DELETE"));
};

const project = (projectId: string) => `/projects/${projectId}`;

/** Dự án dùng mẫu đã lưu của tổ chức: import từ chính file mẫu, mapping heading áp sẵn (bỏ bước xác nhận). */
/** Ý định với file BE lấy từ dự án (hộp Tạo dự án). */
export const importFromOrgTemplate = async (projectId: string, orgTemplateId: string): Promise<{ import: ImportedDocument }> =>
  unwrap(await apiCall<{ import: ImportedDocument }>(`${project(projectId)}/import/from-org`, json("POST", { org_template_id: orgTemplateId })));
/** Lưu file mẫu + mapping đã xác nhận của lần import gần nhất làm mẫu của tổ chức. */
export const saveImportToOrg = async (projectId: string, name: string): Promise<OrgTemplateSummary> =>
  unwrap(await apiCall<OrgTemplateSummary>(`${project(projectId)}/import/save-to-org`, json("POST", { name })));
