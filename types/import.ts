/**
 * Kiểu dữ liệu import mode 1 (upload SRS có sẵn rồi sửa) — bám `flintflow_be/src/modules/import/import.dto.ts`
 * và `docs/api/import-change-contract.md` (FLF-171). Đổi ở BE thì đổi ở đây trong cùng PR.
 */
import type { Baseline, Flag, IsoDateTime } from "./spine";

/** Máy trạng thái import (`import.state.ts` BE). */
export const IMPORT_STATUSES = [
  "uploaded",
  "preflight_rejected",
  "awaiting_latest_confirm",
  "parsing",
  "mapping_review",
  "extracting",
  "fields_review",
  "baselining",
  "checking",
  "gap_review",
  "delivered",
  "change_requested",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** `paused` chỉ đặt ở hai bước gọi AI. */
export type ImportPauseReason = "credits" | "resume_later";
export interface Paused<R extends string = ImportPauseReason> {
  reason: R;
  at: IsoDateTime;
}

export type PreflightIssueCode =
  | "NOT_DOCX"
  | "CORRUPT_ZIP"
  | "LEGACY_DOC"
  | "FILE_ENCRYPTED"
  | "FILE_TOO_LARGE"
  | "EMPTY_DOCUMENT"
  | "FOREIGN_TRACK_CHANGE"
  | "FOREIGN_COMMENT";

export interface PreflightIssue {
  code: PreflightIssueCode;
  message: string;
  location?: { block_ord: number; text: string } | null;
}

export interface DocStamp {
  project_id: string;
  version: string | null;
  source: string | null;
}

export interface ImportedDocument {
  id: string;
  project_id: string;
  original_name: string;
  size: number;
  sha256: string;
  status: ImportStatus;
  preflight: { status: "accepted" | "rejected"; issues: PreflightIssue[] };
  stamp: DocStamp | null;
  confirmed_latest_at: IsoDateTime | null;
  paused: Paused | null;
  /** Section đang/sắp trích (I-4); resume chạy tiếp từ đây. */
  extract_cursor: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export type DocBlockKind =
  | "heading"
  | "paragraph"
  | "list_item"
  | "table"
  | "table_row"
  | "table_cell"
  | "image"
  | "caption"
  | "unsupported";

export type MentionEntity = "use_case" | "function" | "nfr" | "business_rule" | "screen" | "actor" | "entity" | "feature";

export interface DocBlock {
  /** `B0001`… ổn định qua các version. */
  block_id: string;
  doc_version: string;
  kind: DocBlockKind;
  level: number | null;
  heading_path: string[];
  text: string;
  section_id: string | null;
  mentions: { entity: MentionEntity; id: string }[];
  /** `false` với `unsupported`: giữ nguyên, CR không được sửa. */
  editable: boolean;
  locked_by_cr: string | null;
  /** Bản draft: đoạn chèn/xoá do CR ghi, để tô màu (UC-54). */
  revisions?: { kind: "ins" | "del"; text: string; author: string }[];
}

export type HeadingDetector = "style" | "outline_level" | "numbering_pattern" | "user";

export interface HeadingMapEntry {
  block_id: string;
  heading_text: string;
  /** Id section registry hoặc `"unmapped"`. */
  section_id: string;
  confidence: number;
  detected_by: HeadingDetector;
  confirmed: boolean;
}

export interface TableMapEntry {
  block_id: string;
  column_index: number;
  header: string;
  field_path: string | null;
  confidence: number;
  confirmed: boolean;
}

/** Mục của layout tài liệu người dùng (FLF-182): `section_id` = section FPT hoặc `custom:<id>`. */
export interface LayoutEntry {
  order: number;
  heading_text: string;
  level: number;
  section_id: string;
}

export interface TemplateProfile {
  doc_version: string;
  heading_map: HeadingMapEntry[];
  table_map: TableMapEntry[];
  required_sections: string[];
  language: string;
  /** FLF-182 — rỗng với import trước mode 1 v2. */
  layout: LayoutEntry[];
}

// ─── kế hoạch step theo template (#32–#33, FLF-182) ─────────────

export type StepPlanState = "applied" | "hidden" | "enabled";

export interface StepPlanEntry {
  step_id: string;
  state: StepPlanState;
  /** Đầu mục mẫu FPT mà file không có (hoặc chỉ có heading) ⇒ "Thiếu" + cờ đỏ `section_empty` (FLF-183). Giữ nguyên sau khi step chạy xong — "Thiếu" chỉ hiện khi step chưa accepted. */
  missing: boolean;
  section_ids: string[];
  reason: string;
}

export interface StepPlanResponse {
  steps: StepPlanEntry[];
}

export interface StepPlanPatchRequest {
  step_id: string;
  enabled: boolean;
}

export interface ReviewField {
  section_id: string;
  path: string;
  value: unknown;
  confidence: number;
  source_block_ids: string[];
  /** `vision` = đọc từ ảnh diagram (mode 1 v3 phase 5) — luôn cần xác nhận. */
  origin: "deterministic" | "ai" | "vision";
  confirmed: boolean;
  edited_value?: unknown;
}

export interface ExtractionSection {
  section_id: string;
  status: "pending" | "done" | "failed";
  fields_total: number;
  fields_needing_review: number;
  error: string | null;
}

/** Ngưỡng độ tin (BE `import.constants.ts`): mapping < 0.8 ⇒ xác nhận mapping; field < 0.7 ⇒ xác nhận field. */
export const MAPPING_CONFIDENCE_THRESHOLD = 0.8;
export const FIELD_CONFIDENCE_THRESHOLD = 0.7;
export const UNMAPPED_SECTION = "unmapped";

// ─── request ─────────────────────────────────────────────────────

export interface ConfirmLatestRequest {
  import_id: string;
}

export interface MappingPatchRequest {
  import_id: string;
  headings?: { block_id: string; section_id: string }[];
  tables?: { block_id: string; column_index: number; field_path: string | null }[];
  confirm_all?: boolean;
}

export interface ExtractRequest {
  import_id: string;
}

export interface FieldsPatchRequest {
  import_id: string;
  fields?: { section_id: string; path: string; confirmed: boolean; edited_value?: unknown }[];
  confirm_all?: boolean;
}

export interface FinalizeRequest {
  import_id: string;
  base_version: number;
}

// ─── response ────────────────────────────────────────────────────

export interface ImportStateResponse {
  import: ImportedDocument;
}

export interface GetImportResponse {
  import: ImportedDocument | null;
  profile: TemplateProfile | null;
  extraction: { sections: ExtractionSection[]; review_fields: ReviewField[] };
  blocks_count: number;
}

export interface ExtractResponse {
  import: ImportedDocument;
  sections: ExtractionSection[];
}

export interface FinalizeResponse {
  import: ImportedDocument;
  doc_version: "0.0";
  baseline: Baseline;
  spine_version: number;
  flags: { red: number; yellow: number };
}

export interface GapLayoutRow {
  order: number;
  section_id: string;
  heading: string;
  level: number;
  kind: "fpt" | "group" | "custom";
  red: number;
  yellow: number;
}

export interface GapReport {
  project_id: string;
  doc_version: string;
  generated_at: IsoDateTime;
  totals: {
    red: number;
    yellow: number;
    missing_sections: number;
    unmapped_headings: number;
    low_confidence_fields: number;
    missing_fpt_sections: number;
    unrendered_diagrams: number;
  };
  /** Mode 1 v2 (FLF-184, D6): đầu mục mẫu FPT file không có / chỉ có heading — cờ đỏ, chặn ký v1 tới khi chạy `step_id`. */
  missing_fpt_sections: { section_id: string; title: string; step_id: string; in_layout: boolean }[];
  /** Mode 1 v2 (nợ T4): hình dựng được từ Spine nhưng chưa có bản vẽ (import lúc thiếu PlantUML) hoặc vẽ lỗi — không chặn ký v1. */
  unrendered_diagrams: { diagram_id: string; kind: string; section_id: string; title: string; reason: "not_rendered" | "error" }[];
  /** Mục theo thứ tự file upload (FLF-184). */
  layout: GapLayoutRow[];
  /** Cờ theo section — theo thứ tự layout. */
  sections: { section_id: string; title: string; flags: Flag[] }[];
  missing_sections: { section_id: string; title: string }[];
  unmapped_headings: { block_id: string; text: string }[];
  low_confidence_fields: ReviewField[];
}

export type BlockChange = "added" | "removed" | "modified" | "moved";

export interface BlockDiffEntry {
  block_id: string | null;
  change: BlockChange;
  before?: string;
  after?: string;
}

export interface BlockDiffSummary {
  added: number;
  removed: number;
  modified: number;
  moved: number;
}

export interface ReuploadDiff {
  id: string;
  original_name: string;
  against_version: string;
  created_at: IsoDateTime;
  summary: BlockDiffSummary;
  blocks: BlockDiffEntry[];
}

/** `meta` của 422 IMPORT_FILE_REJECTED. */
export interface ImportRejectedMeta {
  import_id: string;
  issues: PreflightIssue[];
}
