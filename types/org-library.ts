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
}
