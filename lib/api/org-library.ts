/**
 * Mẫu cấp tổ chức (FLF-278 trên FLF-335/336, `import-change-contract.md` §FLF-278, §FLF-395). Route tổ chức kiểm membership
 * theo `:orgId`; route dự án đi qua chuỗi guard của `/projects`. Lỗi giữ nguyên `code` qua `ApiClientError`.
 */
import type {
  DeleteTemplateResult,
  HeadingEdit,
  OrgTemplateSummary,
  TemplateProposal,
  TemplateVersionDetail,
} from "@/types/org-library";
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
/** UC-85: đề xuất của dự án mà người đang xem là tác giả baseline; `null` = không có thẻ. */
export const getTemplateProposal = async (projectId: string): Promise<TemplateProposal | null> =>
  (await apiCall<TemplateProposal | null>(`${project(projectId)}/template-proposal`)).data;
/** UC-85: Lead lưu cấu trúc dự án làm mẫu bất cứ lúc nào - dựng đề xuất từ bản mới nhất (AI đổi tên riêng, tốn credit). */
export const createTemplateProposal = async (projectId: string): Promise<TemplateProposal> =>
  unwrap(await apiCall<TemplateProposal>(`${project(projectId)}/template-proposal`, json("POST")));
export type ProposalAction = "send" | "save" | "decline";
/** Analyst: `send` (gửi Lead); Lead: `save` (lưu vào thư viện); ai cũng `decline` (không lưu). */
export const actOnTemplateProposal = async (projectId: string, action: ProposalAction): Promise<TemplateProposal> =>
  unwrap(await apiCall<TemplateProposal>(`${project(projectId)}/template-proposal/${action}`, json("POST")));

/** UC-88: đề xuất Analyst gửi đang chờ Lead duyệt. */
export const listTemplateProposals = async (orgId: string): Promise<TemplateProposal[]> =>
  unwrap(await apiCall<TemplateProposal[]>(`/orgs/${orgId}/template-proposals`));
export const getOrgTemplateProposal = async (orgId: string, proposalId: string): Promise<TemplateProposal> =>
  unwrap(await apiCall<TemplateProposal>(`/orgs/${orgId}/template-proposals/${proposalId}`));
export const decideTemplateProposal = async (orgId: string, proposalId: string, decision: "approve" | "reject"): Promise<TemplateProposal> =>
  unwrap(await apiCall<TemplateProposal>(`/orgs/${orgId}/template-proposals/${proposalId}/${decision}`, json("POST")));
