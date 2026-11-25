/** Đổi mẫu của dự án sau baseline — phản chiếu `MigrationDto` của BE (`import-change-contract.md` §Đổi mẫu). snake_case như BE. */

export type MigrationState = "mapping_review" | "decisions" | "ready" | "applying" | "applied" | "reverting" | "reverted" | "apply_failed" | "cancelled" | "failed";
export type MigrationDirection = "forward" | "reverse";

/** Còn giữ chỗ của dự án (BE: mỗi dự án tối đa một lần đổi mẫu mở). */
export const OPEN_MIGRATION_STATES: readonly MigrationState[] = ["mapping_review", "decisions", "ready", "applying", "reverting", "apply_failed"];
export const isOpenMigration = (state: MigrationState): boolean => OPEN_MIGRATION_STATES.includes(state);

export type PairBy = "section_id" | "overlap" | "title" | "manual";

export interface OldHeading {
  key: string;
  heading_text: string;
  level: number;
  section_id: string;
}

export interface NewHeading {
  key: string;
  heading_text: string;
  section_id: string;
  /** Mapping độ tin thấp được tự nhận — mục "Cần xem". */
  auto_confirmed?: boolean;
  guidance?: string;
  level?: number;
}

export interface SectionPair {
  old_key: string;
  new_key: string | null;
  by: PairBy | null;
  score: number;
  needs_review: boolean;
}

export interface PairEdit {
  old_key: string;
  new_key: string | null;
}

export interface MigrationPairing {
  pairs: SectionPair[];
  followers: { old_key: string; kind: "element" | "continuation"; parent_old_key: string | null }[];
  ignored_new: string[];
  split: { old_key: string; new_keys: string[] }[];
  /** Heading con của mẫu đích nằm cùng mục với heading cha (thuộc mục cha, không thiếu). Bản ghi cũ không có. */
  children?: string[];
}

/** `high`: đã chọn sẵn, dùng luôn nếu không đổi. `guess`: đoán, phải bấm "Đúng" hoặc chọn khác. */
export type SuggestConfidence = "high" | "guess";
/** Lý do của lựa chọn chọn sẵn — FE dịch thành câu ngắn (`reasons.*`). */
export type SuggestReason = "no_place" | "close_name" | "map_columns" | "no_table_in_new" | "keep_history" | "first_heading";
/** Lựa chọn chọn sẵn của một dòng (luôn miễn phí). Bản ghi trước khi có gợi ý thì thiếu. */
export interface Suggestion {
  suggested?: string;
  suggested_reason?: SuggestReason;
  confidence?: SuggestConfidence;
}

export interface MatchedItem {
  id: string;
  old_key: string;
  new_key: string;
  by: PairBy;
  needs_review: boolean;
}

export interface MissingItem {
  id: string;
  new_key: string;
  heading_text: string;
  section_id: string;
  needs_content: boolean;
  guidance: string | null;
  /** Mục thừa đã chọn "chuyển vào" mục này — mục nhận nội dung, không còn phải viết (BE đặt `needs_content = false`). */
  moved_in?: string[];
}

export interface ExtraItem extends Suggestion {
  id: string;
  old_key: string;
  heading_text: string;
  section_id: string;
  follower_keys: string[];
  /** `keep_custom` | `drop_from_print` | `move_to:<new_key>` (BE đã bỏ `delete` khỏi nhóm Thừa; FE vẫn lọc phòng BE cũ). */
  choices: string[];
  /** Lựa chọn cần AI (tính credit). */
  ai_choices: string[];
  decision_required: true;
}

/** Lựa chọn "Không in ra": bỏ khỏi bản in, dữ liệu vẫn giữ và trở lại khi hoàn tác. Tên do BE chốt — đổi ở đây. */
export const DROP_FROM_PRINT_CHOICE = "drop_from_print";

export type ConflictKind = "table_columns" | "split_section" | "record_of_changes";

export interface ConflictItem extends Suggestion {
  id: string;
  kind: ConflictKind;
  old_key: string;
  new_key: string | null;
  candidate_keys: string[];
  old_columns: string[][];
  new_columns: string[][];
  /** `map_by_header` | `keep_old_table` | `delete` | `keep_custom` | `to:<new_key>` | `ai_resolve`. */
  choices: string[];
  ai_choices: string[];
  decision_required: true;
}

export interface EditedItem {
  id: string;
  old_key: string;
  heading_text: string;
  changes: number;
  last_at: string;
  chars: number;
  choices: ["keep", "discard"];
  default: "keep";
}

export interface MigrationGroups {
  matched: MatchedItem[];
  missing: MissingItem[];
  extra: ExtraItem[];
  conflict: ConflictItem[];
  edited_since: EditedItem[];
  structure_only_dropped: string[];
  /** Đổi ngược: số mục chưa sửa tự lấy lại nguyên bản; `null` = đổi xuôi. */
  restored_from_snapshot: number | null;
}

/** Đổi ngược: liên kết sẽ gãy nếu áp dụng ngay (BE chạy khô như bước áp dụng). */
export interface BrokenLink {
  rule: string;
  /** BE có thể không có đường dẫn cụ thể. */
  path: string | null;
  message: string;
}

export type RevertBlockReason = "not_latest" | "migration_open" | "running" | "has_later_changes";

/** Mẫu trước của lần đổi mẫu đã áp dụng — mẫu org, hoặc bản riêng của dự án (dự án từng theo mẫu tự do / FPT). */
export interface PreviousTemplate {
  template_id: string;
  version: number;
  name: string;
  visibility: "org" | "project";
}

export interface MigrationCreditEstimate {
  translation: { chars: number; batches: number; credits: number };
  structural_moves: { count: number; credits: number };
  ai_resolve: { count: number; credits: number };
  total: number;
}

export type OutlineStatus = "kept" | "receives" | "needs_content" | "dropped";
/** Một dòng của dàn tiêu đề tài liệu sau khi đổi (bước Áp dụng), theo thứ tự mẫu mới. */
export interface OutlineEntry {
  heading_text: string;
  level: number;
  status: OutlineStatus;
  from_heading?: string[];
  table_change?: "map" | "keep" | "drop";
  /** Chỉ dòng `dropped`: nội dung sẽ không in (tối đa 5) + tổng số. */
  dropped_items?: { id: string | null; text: string }[];
  dropped_total?: number;
}

export interface MigrationDecision {
  id: string;
  choice: string;
}

export interface Migration {
  id: string;
  project_id: string;
  state: MigrationState;
  direction: MigrationDirection;
  reverse_of: string | null;
  from: { template_ref: { template_id: string; version: number } | null; /** Đang theo mẫu chuẩn FlintFlow. */ standard?: boolean; language: string; template_family: string | null; headings: OldHeading[] };
  /** `standard` = đích là mẫu chuẩn FlintFlow ⇒ `template_id = null`. */
  to: { template_id: string | null; standard?: boolean; version: number; name: string; visibility: "org" | "project"; language: string; template_family: string | null; headings: NewHeading[] };
  pairing: MigrationPairing;
  groups: MigrationGroups;
  decisions: MigrationDecision[];
  /** Dòng đoán chưa xác nhận (và mục của bản ghi cũ chưa có gợi ý) — rỗng mới `ready` được. */
  undecided: string[];
  /** Dàn tiêu đề tài liệu sau khi đổi. Bản BE cũ chưa có ⇒ thiếu. */
  outline?: OutlineEntry[];
  language: { source: string; target: string; needs_translation: boolean; /** Chỉ đổi ngôn ngữ tài liệu (mode 2 / từ FPT): không dịch Spine, không credit. */ switches_document_language: boolean };
  credit_estimate: MigrationCreditEstimate;
  warnings: string[];
  broken_links: BrokenLink[];
  /** Lần đã áp dụng: hoàn tác được không; `null` khi chưa áp dụng. */
  revertable: boolean | null;
  revert_blocked_reason: RevertBlockReason | null;
  previous_template: PreviousTemplate | null;
  /** Mẫu trước của lần đổi là mẫu chuẩn FlintFlow ⇒ "Quay về mẫu trước" bắt đầu bằng `{ kind: "standard" }`. */
  previous_standard?: boolean;
  prepared_spine_version: number | null;
  prepared_source_sha256: string | null;
  applied_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MigrationSummary {
  id: string;
  state: MigrationState;
  direction: MigrationDirection;
  /** Chỉ có giá trị cho lần đã áp dụng mới nhất. */
  revertable: boolean | null;
  revert_blocked_reason: RevertBlockReason | null;
  previous_template: PreviousTemplate | null;
  previous_standard?: boolean;
  to: { template_id: string | null; standard?: boolean; version: number; name: string };
  created_at: string;
  applied_at: string | null;
}

/** Đích chọn từ mẫu org (bản bất kỳ) hoặc file tải lên (Lead có thể đăng lên thư viện). */
export type StartMigrationInput =
  | { kind: "template"; template_id: string; version: number }
  | { kind: "standard"; language?: "vi" | "en" }
  | { kind: "file"; file: File; publish_to_org?: boolean; name?: string; template_id?: string };

/** Sửa mapping heading → mục của file mẫu tải lên: `key` = `n<vị trí heading>`. */
export interface MappingEdit {
  key: string;
  section_id: string;
}

export type BatchAction = "keep_all" | "discard_all";

/** `GET /projects/:id` → `template_update` (chỉ Lead / Analyst, chỉ khi bản org mới hơn bản dự án theo). */
export interface TemplateUpdate {
  template_id: string;
  name: string;
  current_version: number;
  latest_version: number;
}

/** `GET /projects/:id` → `template_current`: mẫu dự án đang theo (mọi thành viên); `null` = file mẫu của chính dự án. */
export interface TemplateCurrent {
  template_id: string;
  name: string;
  version: number;
  kind: "org" | "skeleton" | "project";
}
