/**
 * Kiểu dữ liệu import mode 1 (upload SRS có sẵn rồi sửa) — bám `flintflow_be/src/modules/import/import.dto.ts`
 * và `docs/api/import-change-contract.md` (FLF-171). Đổi ở BE thì đổi ở đây trong cùng PR.
 */
import type { RocRow } from "./document";
import type { TemplateIntent } from "./project";
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
  /** FLF-336 I-5: file thiếu mục của cấu trúc đích ⇒ dừng ở "Kết quả đọc file", không có v0. */
  "incomplete",
  /** FLF-453 (business-flow §3.1.2 "Rà soát phần có sẵn"): còn mục cần AI rà trước Luồng 2 — chờ xác nhận credit. */
  "reviewing",
  /** FLF-278 trên FLF-336: chế độ 3 đi tiếp Luồng 2 — dự án sang pipeline tạo mới viết phần còn thiếu. */
  "drafting",
  "checking",
  "gap_review",
  "delivered",
  "change_requested",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/**
 * `paused` chỉ đặt ở hai bước gọi AI. `user`: người dùng bấm Dừng lúc đọc nội dung hoặc kiểm tra AI (`POST /import/pause`).
 * `credit_notice` (FLF-454): `checking` dừng để báo lại credit bước kiểm tra AI (số thực tế lớn hơn số đã báo) — đọc số ở `credit_estimate`.
 */
export type ImportPauseReason = "credits" | "resume_later" | "user" | "credit_notice";
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
  | "FOREIGN_COMMENT"
  /** FLF-331: Code không thấy dấu hiệu SRS / mẫu SRS (CV, hoá đơn, test plan…). */
  | "NOT_SRS"
  /** FLF-343: qua preflight nhưng tách file / khớp mẫu lỗi — không treo ở `parsing`. */
  | "PARSE_FAILED";

/** FLF-331: loại tài liệu Code nhận ra ở I-1 (0 credit); `unknown` ⇒ vẫn nhận nhưng cảnh báo ở bước xác nhận. */
export interface DocumentKind {
  kind: "srs" | "srs_template" | "not_srs" | "unknown";
  confidence: number;
  signals: string[];
  reasons: string[];
}

export interface PreflightIssue {
  code: PreflightIssueCode;
  message: string;
  location?: { block_ord: number; text: string } | null;
}

export interface DocStamp {
  project_id: string;
  version: string | null;
  source: string | null;
  /** FLF-334: release gốc (`2.0`, `0`), CR mới nhất, loại bản — stamp cũ ⇒ `null`. */
  base_version: string | null;
  latest_cr: string | null;
  kind: "release" | "draft" | null;
}

export interface ImportedDocument {
  id: string;
  project_id: string;
  original_name: string;
  size: number;
  sha256: string;
  status: ImportStatus;
  preflight: { status: "accepted" | "rejected"; issues: PreflightIssue[]; document_kind?: DocumentKind | null };
  stamp: DocStamp | null;
  /**
   * FLF-458: file nhận lúc tạo dự án mang dấu của một project FlintFlow khác (dấu đã bị bỏ, xem `stamp`) — màn đọc khung
   * báo "File này lấy từ dự án <tên>". `name: null` khi project gốc khác tổ chức hoặc không còn.
   */
  foreign_project?: { project_id: string; name: string | null } | null;
  confirmed_latest_at: IsoDateTime | null;
  paused: Paused | null;
  /** Section đang/sắp trích (I-4); resume chạy tiếp từ đây. */
  extract_cursor: string | null;
  /**
   * FLF-360: đang đọc lại vì AI quá tải — `images`: ảnh sơ đồ chưa đọc được (`done`/`total` ảnh), `text`: một lô chữ của
   * `section_id` (`done`/`total` lượt). `null` / thiếu = không đọc lại.
   */
  reread?: { kind: "images" | "text"; done: number; total: number; section_id: string } | null;
  /** FLF-335: ý định lúc upload — file theo mẫu cố định hay cấu trúc tự do; bản ghi cũ `null` / thiếu (coi như `free`). */
  intent?: TemplateIntent | null;
  /** Mục mà kết quả đọc cuối khác màn đọc khung (rỗng ⇒ khớp; `null` ⇒ chưa đọc xong / import cũ). */
  structure_changes?: StructureChange[] | null;
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

/** FLF-343 thêm `toc` (trùng mục lục), `numbering` (đánh số tự động), `format` (chữ to / style tiêu đề riêng). */
export type HeadingDetector = "style" | "outline_level" | "numbering_pattern" | "user" | "toc" | "numbering" | "format";

export interface HeadingMapEntry {
  block_id: string;
  heading_text: string;
  /** Id section registry hoặc `"unmapped"`. */
  section_id: string;
  confidence: number;
  detected_by: HeadingDetector;
  confirmed: boolean;
  /** FLF-343: độ tin thấp, tự nhận lúc tách file — có cờ vàng "Cần xem" sau baseline 0.1. */
  auto_confirmed?: boolean;
  /**
   * FLF-363: phần của ngân hàng phần chung FPT + IEEE khớp theo tên. Mã nội bộ — FE không hiện, chỉ dùng để biết
   * `unmapped` này là mục riêng của mẫu (giữ nguyên văn), không phải heading lạ.
   */
  template_section?: string | null;
  /** FLF-363: mục theo tên (`by_title`) khác mục theo nội dung (`by_content`) — heading đã đổi theo nội dung. */
  content_mismatch?: { by_title: string; by_content: string };
  /** FLF-278 trên FLF-336 (business-flow 1.5): chữ hướng dẫn của mẫu dưới heading — chỉ để xem, không phải nội dung. */
  guidance?: string;
  /** FLF-364: nguồn của `guidance` — chữ trong `[ ]` / `{ }`, có / không kèm kiểu chữ hướng dẫn; block chứa nó. */
  guidance_by?: "brackets" | "brackets+format";
  guidance_blocks?: string[];
  /** FLF-362: nhãn số Word tự đánh của heading ("2.1.", "II.") — không nằm trong `heading_text`; hiển thị = nhãn + tiêu đề. */
  number_label?: string;
}

/** Nhãn họ mẫu của tài liệu upload (FLF-363) — tính sau khi khớp, chỉ để báo cáo. */
export type TemplateFamily = "fpt" | "ieee29148" | "mixed";

/** Vai trò cột theo dữ liệu dưới tiêu đề (FLF-252). */
export type TableColumnRole = "row_no" | "code" | "date" | "version" | "change_type" | "mark" | "text" | "name";

export interface TableMapEntry {
  block_id: string;
  column_index: number;
  header: string;
  field_path: string | null;
  confidence: number;
  confirmed: boolean;
  /** FLF-343: như `HeadingMapEntry.auto_confirmed`. */
  auto_confirmed?: boolean;
  /** FLF-252: vai trò cột theo dữ liệu; không có khi bảng chỉ có hàng tiêu đề. */
  role?: TableColumnRole;
  /** FLF-252: tối đa 3 giá trị đầu của cột. */
  samples?: string[];
  /** FLF-364: chữ hướng dẫn trong các ô của cột (`[Tên tác nhân]`), bỏ ngoặc. */
  guidance?: string;
}

/** Mục của layout tài liệu người dùng (FLF-182): `section_id` = section FPT hoặc `custom:<id>`. */
export interface LayoutEntry {
  order: number;
  heading_text: string;
  level: number;
  section_id: string;
  /** FLF-362: như `HeadingMapEntry.number_label`. */
  number_label?: string;
}

export interface TemplateProfile {
  doc_version: string;
  heading_map: HeadingMapEntry[];
  table_map: TableMapEntry[];
  language: string;
  /** FLF-182 — rỗng với import trước mode 1 v2. */
  layout: LayoutEntry[];
  /** FLF-252: dòng Record of Changes đọc được từ file; rỗng / thiếu = không tìm thấy bảng. */
  record_of_changes?: RocRow[];
  /** FLF-252: họ mẫu nhận được — thiếu (import cũ) coi như `fpt`. */
  template_family?: TemplateFamily;
}

// ─── kế hoạch step theo template (#32–#33, FLF-182) ─────────────

export type StepPlanState = "applied" | "hidden" | "enabled";

export interface StepPlanEntry {
  step_id: string;
  state: StepPlanState;
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
  /** Tên phần tử chứa field (`actors[id=A01].kind` ⇒ "Learner"); field tên / không tra được ⇒ không có. */
  entity_name?: string;
}

/** FLF-462 (bước 1.6): đoạn lớp 4 chữ hướng dẫn AI phân loại ở I-4, độ tin < 0.7, chờ người xác nhận. */
export interface ReviewGuidance {
  section_id: string;
  block_id: string;
  /** Nguyên văn đoạn, để người dùng đọc và quyết định đây có phải chữ hướng dẫn không. */
  text: string;
  is_guidance: boolean;
  confidence: number;
  confirmed: boolean;
}

/** FLF-462 (bước 1.6, FLF-444 đánh dấu): mục khớp theo tên mà I-4 đọc ra nội dung của loại khác, chờ người xem qua. */
export interface ReviewContentMismatch {
  section_id: string;
  by_heading: string[];
  by_content: string[];
  note: string | null;
  confirmed: boolean;
}

/** Thứ AI tìm thấy trong một mục: `entity` là khoá thô (`use_cases`, `actors`…) hoặc `diagram` (names = loại sơ đồ). */
export interface FoundGroup {
  entity: string;
  count: number;
  names: string[];
}

export interface ExtractionSection {
  section_id: string;
  status: "pending" | "done" | "failed";
  fields_total: number;
  fields_needing_review: number;
  error: string | null;
  /** AI đang đọc mục này lúc này (nhiều mục có thể cùng lúc). Thiếu (BE cũ) ⇒ coi như false. */
  reading?: boolean;
  /** Thứ đã tìm thấy trong mục. Thiếu (BE cũ) ⇒ rỗng. */
  found?: FoundGroup[];
}

/** `GET /projects/:id/import/source` — chữ gốc của file theo mục, đúng thứ tự trong file. Tải một lần, không poll. */
export interface ImportSourceBlock {
  block_id: string;
  kind: DocBlockKind;
  /** Bảng: các dòng `| a | b |` nối bằng xuống dòng; ảnh: rỗng. */
  text: string;
}
export interface ImportSourceSection {
  section_id: string;
  title: string;
  level: number;
  blocks: ImportSourceBlock[];
}
export interface ImportSourceResponse {
  import_id: string;
  sections: ImportSourceSection[];
}

/** Ngưỡng độ tin (BE `import.constants.ts`): mapping < 0.9 ⇒ xác nhận mapping; field < 0.8 ⇒ xác nhận field. */
export const MAPPING_CONFIDENCE_THRESHOLD = 0.8;
export const FIELD_CONFIDENCE_THRESHOLD = 0.7;
export const UNMAPPED_SECTION = "unmapped";

// ─── request ─────────────────────────────────────────────────────

export interface ConfirmLatestRequest {
  import_id: string;
}

/** FLF-460: đổi nhãn một heading - `section_id` đổi mục khớp; `scope` đưa vào / ra Ngoài phạm vi ("auto" = bỏ nhãn tay). */
export interface MappingHeadingPatch {
  block_id: string;
  section_id?: string;
  scope?: "out_of_scope" | "in_scope" | "auto";
}

export interface MappingPatchRequest {
  import_id: string;
  headings?: MappingHeadingPatch[];
  tables?: { block_id: string; column_index: number; field_path: string | null }[];
  confirm_all?: boolean;
}

export interface ExtractRequest {
  import_id: string;
}

export interface FieldsPatchRequest {
  import_id: string;
  fields?: { section_id: string; path: string; confirmed: boolean; edited_value?: unknown }[];
  /** FLF-462 (bước 1.6): xác nhận đoạn lớp 4 là / không là chữ hướng dẫn (có thể sửa lại giá trị AI chấm). */
  guidance?: { section_id: string; block_id: string; is_guidance: boolean }[];
  /** FLF-462 (bước 1.6): xác nhận đã xem mục tên đúng nội dung sai; không đổi phân loại, chỉ bỏ cờ chờ. */
  content_mismatch?: { section_id: string }[];
  confirm_all?: boolean;
}

export interface FinalizeRequest {
  import_id: string;
  base_version: number;
  /** FLF-252: dòng Record of Changes người dùng đã xem/sửa ở wizard — không gửi ⇒ BE đọc lại từ file. */
  record_of_changes?: RocRow[];
  /** FLF-336: từ "Kết quả đọc file" bấm Hoàn thiện ⇒ đi tiếp dù còn mục thiếu. */
  complete?: boolean;
}

// ─── response ────────────────────────────────────────────────────

export interface ImportStateResponse {
  import: ImportedDocument;
}

/**
 * Ước tính cả lượt import một mạch (FLF-343, `GET /import` → `credit_estimate`, BE import-change-contract §4.15): I-4 còn phải
 * chạy + kiểm tra AI sau baseline 0.1 — chỉ có ở `extracting` (bản ghi cũ: `mapping_review`) khi job chưa chạy / đang dừng.
 * `available_credits` = credit khả dụng của ví org; `null` với Viewer.
 */
export interface CreditEstimate {
  text_batches: number;
  diagram_images: number;
  /** FLF-343: lượt AI của bước kiểm tra — đã gộp vào `ai_calls` / `credits`. */
  check_calls?: number;
  /** FLF-456: lô dịch khung (chọn ngôn ngữ khác file khi file chỉ còn khung) — đã gộp vào `ai_calls` / `credits`. */
  translate_batches?: number;
  /** FLF-458: tài liệu tham khảo đang chờ đọc, đọc cùng lượt Bắt đầu — đã gộp vào `ai_calls` / `credits`. */
  reference_documents?: number;
  reference_credits?: number;
  ai_calls: number;
  credits: number;
  available_credits: number | null;
}

export interface GetImportResponse {
  import: ImportedDocument | null;
  profile: TemplateProfile | null;
  extraction: { sections: ExtractionSection[]; review_fields: ReviewField[]; review_guidance: ReviewGuidance[]; review_content_mismatch: ReviewContentMismatch[] };
  blocks_count: number;
  credit_estimate?: CreditEstimate | null;
  /** FLF-336 I-5: có sau lần finalize đầu (kể cả khi dừng ở `incomplete`). */
  target_structure?: TargetStructure | null;
  /** Màn đọc khung: cấu trúc đích sơ bộ tính bằng Code lúc upload (trước Bắt đầu, không tốn credit). */
  structure_preview?: StructurePreview | null;
  /** FLF-412: mục có chữ của file + lựa chọn Bỏ chữ — chỉ có trước Bắt đầu; khác ⇒ null. */
  text_sections?: TextSection[] | null;
  /** FLF-456: ô ngôn ngữ tài liệu — `visible` chỉ khi mọi mục có chữ đã Bỏ chữ; chỉ có trước Bắt đầu. */
  skeleton_language?: SkeletonLanguage | null;
  /** FLF-453 (business-flow §3.1.2): chỉ có khi import ở `reviewing` — mục Code chọn cho AI rà + credit vòng rà soát. */
  review?: ReviewEstimate | null;
}

/** FLF-453: mục cần AI rà trước Luồng 2 + credit ước tính, báo trước khi người dùng xác nhận chạy. */
export interface ReviewEstimate {
  section_ids: string[];
  calls: number;
  credits: number;
  /** Mục chỉ được Code kiểm có chữ để AI rà, kèm credit riêng (nút "Rà soát bằng AI" từng mục). Thiếu (BE cũ) ⇒ rỗng. */
  optional_sections?: OptionalReviewSection[];
}

export interface OptionalReviewSection {
  section_id: string;
  title: string;
  calls: number;
  credits: number;
}

/** FLF-453 `POST /import/review/section` với `confirm: true` — `reviewed: false` khi hết credit / lỗi (import đang `paused`). */
export interface ReviewSectionResponse {
  import: ImportedDocument;
  section_id: string;
  reviewed: boolean;
}

/** FLF-456: trạng thái ô EN / VI của màn đọc khung (`file` = ngôn ngữ của file, `selected` = đang chọn). */
export interface SkeletonLanguage {
  visible: boolean;
  file: "en" | "vi";
  selected: "en" | "vi";
}

/** FLF-412: vùng heading có chữ ở màn đọc khung (khoá = `block_id` của heading). */
export interface TextSection {
  key: string;
  title: string;
  level: number;
  dropped: boolean;
}

/**
 * Màn đọc khung (business-flow §3.1.2) — BE `structurePreviewSchema`. `sections` theo thứ tự heading trong file; `kind = template`
 * khi phần lớn mục chưa có nội dung (khung mẫu để FlintFlow soạn).
 */
export interface StructurePreview {
  summary: { present: number; missing: number; out_of_scope: number; kind: "written" | "template" };
  /** `excerpt` (P09 #15): trích đoạn chữ khách viết dưới mục (≤ 200 ký tự) — mục còn trống / import cũ ⇒ không có. */
  sections: {
    section_id: string;
    title: string;
    status: TargetSectionStatus;
    order: number;
    excerpt?: string;
    /** FLF-460: heading của file (khoá đổi nhãn); `uncertain` = I-3 khớp độ tin thấp (kèm `matched_title`); `scope_label` = nhãn Ngoài phạm vi người dùng đổi. */
    block_id?: string;
    uncertain?: boolean;
    matched_title?: string;
    scope_label?: "out_of_scope" | "in_scope";
  }[];
  resolved_mode: 1 | 3 | 4;
  intent: "fixed" | "free";
  computed_at: string;
}

/** Mục mà kết quả đọc cuối khác bản sơ bộ — `absent` = không có ở một bên. */
export interface StructureChange {
  section_id: string;
  title: string;
  from: TargetSectionStatus | "absent";
  to: TargetSectionStatus | "absent";
}

/** FLF-336 I-5 — bản đồ mục của file ⇒ cấu trúc đích (BE `targetStructureSchema`). */
export type TargetSectionStatus = "present" | "missing" | "out_of_scope";
export interface TargetSection {
  section_id: string;
  title: string;
  status: TargetSectionStatus;
  owner_steps: string[];
}
export interface TargetStructure {
  target: "fpt" | "template";
  intent: "fixed" | "free";
  /** Chế độ thật: 1 đủ · 3 mẫu cố định còn thiếu · 4 tự do còn thiếu. */
  resolved_mode: 1 | 3 | 4;
  sections: TargetSection[];
  missing: string[];
  compared_at: IsoDateTime;
}

export interface ExtractResponse {
  import: ImportedDocument;
  sections: ExtractionSection[];
}

/**
 * #8 chạy nền (contract §4.16): trả ngay import `baselining`; `baseline` / `flags` luôn `null` — kết quả đọc qua poll #4
 * (`gap_review`) và gap report.
 */
export interface FinalizeResponse {
  import: ImportedDocument;
  doc_version: string;
  baseline: Baseline | null;
  spine_version: number;
  flags: { red: number; yellow: number } | null;
}

/** #8b `POST /import/continue` — chế độ 3 sang Luồng 2 (dự án thành `mode = fpt`). */
export interface ContinueFlow2Response {
  project_mode: "fpt";
  import_state: "drafting";
  current_step: string | null;
  spine_version: number;
}

/** FLF-461 bước 2.9a `GET /import/layout-preview` và `POST /import/layout-preview/confirm` (chế độ 4). */
export interface LayoutPreviewItem {
  section_id: string;
  title: string;
  level: number;
  origin: "file" | "added" | "out_of_scope";
}

export interface LayoutPreview {
  applicable: boolean;
  confirmed_at: IsoDateTime | null;
  /** BF 2.9a sau 2.8-2.9: chỉ `true` khi mọi mục còn thiếu đã soạn xong; chưa `ready` thì không hiện thẻ. */
  ready?: boolean;
  remaining?: number;
  sections: LayoutPreviewItem[];
}

/**
 * FLF-453 `POST /import/review/run` — xong vòng rà soát thì giống `ContinueFlow2Response` (sang Luồng 2); lượt AI lỗi /
 * hết credit thì trả `import` đang `paused`, vẫn `reviewing` (gọi lại endpoint này để tiếp tục).
 */
export type ReviewRunResponse = ContinueFlow2Response | { import: ImportedDocument };

/** FLF-453 `POST /import/review/stop` — bấm Dừng khi vòng rà soát đang chạy. */
export interface ReviewStopResponse {
  import: ImportedDocument;
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
    low_confidence_fields: number;
    unrendered_diagrams: number;
  };
  /** Mode 1 v2 (nợ T4): hình dựng được từ Spine nhưng chưa có bản vẽ (import lúc thiếu PlantUML) hoặc vẽ lỗi — không chặn ký v1. */
  unrendered_diagrams: { diagram_id: string; kind: string; section_id: string; title: string; reason: "not_rendered" | "error" }[];
  /** Mục theo thứ tự file upload (FLF-184). */
  layout: GapLayoutRow[];
  /** Cờ theo section — theo thứ tự layout. */
  sections: { section_id: string; title: string; flags: Flag[] }[];
  low_confidence_fields: ReviewField[];
}

export type BlockChange = "added" | "removed" | "modified" | "moved";

export type DiffBlockKind = "paragraph" | "table" | "image" | "heading";

/** Một hàng của bảng trong diff theo hàng; hàng không đổi liền nhau gộp `unchanged` (FE vẽ `⋯ n hàng`). */
export type TableRowDiff =
  | { change: Exclude<BlockChange, "moved">; before?: string[]; after?: string[]; cells_changed?: number[] }
  | { change: "unchanged"; count: number; rows: string[][] };

export interface TableDiff {
  header: string[];
  /** Chỉ khi hàng tiêu đề đổi. */
  header_before?: string[];
  rows: TableRowDiff[];
}

export interface BlockDiffEntry {
  block_id: string | null;
  change: BlockChange;
  before?: string;
  after?: string;
  /** Tiêu đề mục chứa block ("" = trước heading đầu). Bản ghi cũ không có ⇒ gom vào nhóm "Khác". */
  section?: string;
  /** Khoá mục = đường heading ("A > B"): mục trùng tên ở hai chỗ khác nhau không bị gộp. */
  section_key?: string;
  kind?: DiffBlockKind;
  /** Bảng khớp mà khác chữ ⇒ diff theo hàng. */
  table?: TableDiff;
}

/** Số block không đổi của một mục (không trả chữ). */
export interface DiffSectionStat {
  title: string;
  /** Khoá mục; thiếu ở bản ghi cũ. */
  key?: string;
  unchanged: number;
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
  /** Bản ghi cũ ⇒ []. */
  sections?: DiffSectionStat[];
  /** FLF-457: chưa có baseline ⇒ so với nội dung đang soạn (`against_version = "DRAFT"`), chỗ nhận thành bản sửa qua chat. */
  before_baseline?: boolean;
  /** FLF-457: file không có dấu version ⇒ đã so theo nội dung với bản nháp hiện tại. */
  no_stamp?: boolean;
  /** FLF-457: tỉ lệ heading của bản đang so tìm thấy trong file (0…1). */
  heading_match?: number;
  /** FLF-457: heading khớp dưới ngưỡng ⇒ gợi ý Dùng làm tham khảo. */
  suggest_reference?: boolean;
  /** FLF-457: dấu version của file cũ hơn bản hiện tại. */
  stale?: { file_version: string; current_version: string } | null;
  /** FLF-457: Track Changes / comment của người ngoài trong file, mỗi chỗ một dòng. */
  markup?: ReuploadMarkup[];
}

/** FLF-457: một chỗ Track Changes / comment của người ngoài trong file upload lại. */
export interface ReuploadMarkup {
  kind: "track_change" | "comment";
  author: string;
  change?: "text" | "format";
  text: string;
  section: string;
  location: { block_ord: number; text: string } | null;
}

/** `meta` của 422 IMPORT_FILE_REJECTED. */
export interface ImportRejectedMeta {
  import_id: string;
  issues: PreflightIssue[];
}
