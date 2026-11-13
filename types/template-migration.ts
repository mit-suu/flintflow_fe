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

export interface ExtraItem {
  id: string;
  old_key: string;
  heading_text: string;
  section_id: string;
  follower_keys: string[];
  /** `keep_custom` | `delete` | `move_to:<new_key>`. */
  choices: string[];
  /** Lựa chọn cần AI (tính credit). */
  ai_choices: string[];
  decision_required: true;
}

/** Lựa chọn của mục thừa thuộc khung (dữ liệu có cấu trúc): bỏ khỏi bản in, dữ liệu vẫn giữ và trở lại khi hoàn tác. Tên do BE chốt — đổi ở đây. */
export const DROP_FROM_PRINT_CHOICE = "drop_from_print";

export type ConflictKind = "table_columns" | "split_section" | "record_of_changes";

export interface ConflictItem {
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
  from: { template_ref: { template_id: string; version: number } | null; language: string; template_family: string | null; headings: OldHeading[] };
  to: { template_id: string; version: number; name: string; visibility: "org" | "project"; language: string; template_family: string | null; headings: NewHeading[] };
  pairing: MigrationPairing;
  groups: MigrationGroups;
  decisions: MigrationDecision[];
  /** Mục bắt buộc chọn mà chưa có quyết định — rỗng mới `ready` được. */
  undecided: string[];
  language: { source: string; target: string; needs_translation: boolean; /** Chỉ đổi ngôn ngữ tài liệu (mode 2 / từ FPT): không dịch Spine, không credit. */ switches_document_language: boolean };
  credit_estimate: MigrationCreditEstimate;
  warnings: string[];
  broken_links: BrokenLink[];
  /** Lần đã áp dụng: hoàn tác được không; `null` khi chưa áp dụng. */
  revertable: boolean | null;
  revert_blocked_reason: RevertBlockReason | null;
  previous_template: PreviousTemplate | null;
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
  to: { template_id: string; version: number; name: string };
  created_at: string;
  applied_at: string | null;
}

/** Đích chọn từ mẫu org (bản bất kỳ) hoặc file tải lên (Lead có thể đăng lên thư viện). */
export type StartMigrationInput =
  | { kind: "template"; template_id: string; version: number }
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
