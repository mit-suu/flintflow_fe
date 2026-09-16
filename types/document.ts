/** Trạng thái section là hàm tính ở BE (`srs-spine.md` §5). */
export type SectionStatus = "draft" | "accepted" | "stale" | "derived";

export type DocumentSource = "draft" | "baseline";

/*
 * RenderedDocument — ĐỒNG BỘ TAY, nguồn là BE `modules/render/rendered-document.types.ts` (T05).
 * Ảnh qua HTTP là chuỗi base64 (có thể kèm tiền tố `data:image/png;base64,`), hoặc tham chiếu
 * `diagram-ref:<diagramId>` khi BE lộ cache nội bộ — FE tải lại qua `GET /diagrams/:id.png`.
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Code inline (font đơn cách). */
  code?: boolean;
}

/** Một ô bảng = một dãy run (giữ được bold/italic trong ô). */
export type TableCell = InlineRun[];

export type Block =
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "heading"; level: number; text: string }
  | { type: "bullet_list"; items: InlineRun[][] }
  | { type: "numbered_list"; items: InlineRun[][] }
  | { type: "table"; header: TableCell[]; rows: TableCell[][] }
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

export type RocChangeType = "A" | "M" | "D";

/** Một dòng bảng §I Record of Changes (khung FPT). */
export interface RocRow {
  /** `YYYY-MM-DD`. */
  date: string;
  version: string;
  change_type: RocChangeType;
  in_charge: string;
  description: string;
}

export interface FlagRow {
  id: string;
  rule_id: string;
  /** Nhãn section đã phân giải để hiển thị (`3.2.1 Create Project`), không phải khoá logic. */
  section: string;
  message: string;
  waive_reason?: string | null;
}

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

/** `meta` của `GET /document?source=draft` — vắng mặt khi `source=baseline`. */
export interface DraftMeta {
  assembled_at_version: number;
  spine_version: number;
  stale: boolean;
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
