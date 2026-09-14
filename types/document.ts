import type { Flag } from "./spine";

/** Section legacy (`/specifications/projects/:id`) — thay bằng `RenderedDocument` ở T16. */
export interface SectionItem {
  _id?: string;
  type: string;
  content: string;
  status: string;
  sourceType?: string;
}

/** Trạng thái section là hàm tính ở BE (`srs-spine.md` §5). */
export type SectionStatus = "draft" | "accepted" | "stale" | "derived";

export type DocumentSource = "draft" | "baseline";

/*
 * RenderedDocument — ĐỒNG BỘ TAY, nguồn là BE `modules/render/rendered-document.types.ts` (T05).
 * Ảnh qua HTTP là chuỗi base64.
 */

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type Block =
  | { type: "paragraph"; runs: TextRun[] }
  | { type: "heading"; level: number; text: string }
  | { type: "bullet_list"; items: TextRun[][] }
  | { type: "numbered_list"; items: TextRun[][] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "image"; png: string; caption?: string }
  | { type: "page_break" };

export interface RenderedSection {
  id: string;
  number: string;
  heading: string;
  level: number;
  status?: SectionStatus;
  awaiting_reaccept?: boolean;
  blocks: Block[];
}

/** Một dòng bảng §I Record of Changes. */
export interface RocRow {
  date: string;
  action: "A" | "M" | "D";
  in_charge: string;
  description: string;
}

export type FlagRow = Pick<Flag, "id" | "rule_id" | "section_id" | "message" | "waive_reason">;

export interface RenderedDocument {
  /** Bắt buộc: ghi vào custom property của file .docx làm "dấu version FlintFlow" (business-flow I-1). */
  projectId: string;
  projectName: string;
  version: string;
  source: DocumentSource;
  watermark?: "DRAFT";
  generatedAt: string;
  sections: RenderedSection[];
  recordOfChanges: RocRow[];
  flagsAppendix?: {
    redOpen: FlagRow[];
    staleCount: number;
    waived: FlagRow[];
  };
}

/** Tài liệu đính kèm của project (`/projects/:id/documents`). */
export interface ProjectDocument {
  _id: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  extension?: string | null;
  parseStatus: "pending" | "success" | "failed";
  parseError?: string | null;
  tokenCount?: number | null;
  summary?: string | null;
  summaryStatus: "pending" | "success" | "failed";
  createdAt: string;
  updatedAt: string;
}
