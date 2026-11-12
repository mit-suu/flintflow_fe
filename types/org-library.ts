/** FLF-278 trên FLF-335/336 — mẫu và thư viện nội dung cấp tổ chức (`import-change-contract.md` §FLF-278). */
import type { CustomBlock } from "./spine";

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

export type PendingDecision = "pending" | "keep" | "generic" | "drop";

export interface PendingHeading {
  key: string;
  heading_text: string;
  level: number;
  kind: "custom" | "wording";
  standard_title: string | null;
  suggestion: string | null;
  suggestion_reason: string | null;
  decision: PendingDecision;
  generic_text: string | null;
}

export interface SkeletonPending {
  template_id: string;
  name: string;
  version: number;
  pending_count: number;
  headings: PendingHeading[];
  /** Credit một lượt "Gợi ý tên chung". */
  suggest_credit_cost: number;
}

export interface SkeletonDecision {
  key: string;
  decision: "keep" | "generic" | "drop";
  generic_text?: string;
}

export interface ContentEntry {
  id: string;
  title: string;
  blocks: CustomBlock[];
  updated_at: string;
}

/** Mục riêng của dự án trùng tiêu đề với một mục trong thư viện. */
export interface LibraryMatch {
  custom_section_id: string;
  heading: string;
  empty: boolean;
  entry: ContentEntry;
}

export interface ContentEntryInput {
  title: string;
  blocks: { kind: "paragraph" | "list_item"; text: string }[];
}
