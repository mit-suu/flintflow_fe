/** FLF-278 trên FLF-335/336 — mẫu cấp tổ chức (`import-change-contract.md` §FLF-278). */
export interface OrgTemplateSummary {
  id: string;
  name: string;
  source_file_name: string;
  heading_count: number;
  /** Heading giữ nguyên văn (không khớp mục FlintFlow) — thành mục riêng. */
  custom_count: number;
  template_family: string | null;
  uses: number;
  created_at: string;
  /** 0 = chưa đăng bản nào (họ chỉ có bản nháp, chỉ Lead thấy). */
  latest_version: number;
  project_count: number;
  /** Mục chờ duyệt của bản mới nhất (mẫu khung tự lưu). */
  pending_count: number;
  /** Mẫu khung tự lưu từ một dự án. */
  skeleton: boolean;
  /** Dự án nguồn của mẫu khung tự lưu (mở duyệt mục chờ); mẫu thường `null` / thiếu. */
  skeleton_source_project_id?: string | null;
  /** Tên dự án nguồn - hiện "Lưu từ dự án <tên>" (UC-85). */
  skeleton_source_project_name?: string | null;
  /** Mới nhất trước; bản nháp chỉ có với Lead. */
  versions: TemplateVersionSummary[];
}

export interface TemplateVersionSummary {
  version: number;
  status: "draft" | "published";
  source_file_name: string;
  heading_count: number;
  custom_count: number;
  language: string;
  template_family: string | null;
  project_count: number;
  pending_count: number;
  /** Người tạo / đăng bản; `name` null khi người đó không còn là thành viên của tổ chức. */
  published_by?: { id: string; name: string | null } | null;
  created_at: string;
}

export interface TemplateHeading {
  index: number;
  heading_text: string;
  section_id: string;
  /** Mapping tự nhận vì độ tin thấp — mục "Cần xem". */
  auto_confirmed?: boolean;
  guidance?: string;
  /** FLF-412: file mẫu còn chữ thật dưới heading này (chưa xoá nội dung cũ). */
  has_text?: boolean;
}

export interface TemplateVersionDetail extends TemplateVersionSummary {
  template_id: string;
  name: string;
  headings: TemplateHeading[];
}

export interface HeadingEdit {
  index: number;
  section_id: string;
}

export interface DeleteTemplateResult {
  deleted: true;
  project_count: number;
  template_deleted?: boolean;
}

/** UC-85 / UC-88 - đề xuất lưu cấu trúc dự án thành mẫu tổ chức (`GET /projects/:id/template-proposal`, `/orgs/:orgId/template-proposals`). */
export type TemplateProposalStatus = "proposed" | "sent" | "approved" | "rejected" | "declined" | "superseded";

/** Một heading AI đổi tên riêng thành chỗ trống; `generic: null` = heading bị bỏ khỏi mẫu (chỉ dùng được cho dự án này). */
export interface ProposalReplacedName {
  key: string;
  original: string;
  generic: string | null;
  reason: string | null;
}

export interface TemplateProposal {
  id: string;
  project_id: string;
  project_name: string;
  status: TemplateProposalStatus;
  /** Heading của khung sau khi đổi tên. */
  headings: string[];
  replaced_names: ProposalReplacedName[];
  created_by: { id: string; name: string | null };
  created_at: string;
  template_id: string | null;
  version: number | null;
}
