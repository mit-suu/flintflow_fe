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
