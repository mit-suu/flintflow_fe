/**
 * Kiểu dữ liệu Spine — ĐỒNG BỘ TAY, nguồn là BE `flintflow_be/src/modules/spine/spine.types.ts` (T01).
 * Tên field giữ snake_case y như `srs-spine.md` §2 để path op khớp tài liệu.
 * Tại thời điểm tạo file BE chưa có `spine.types.ts`; bản này chép từ `srs-spine.md` §2 và phải
 * đối chiếu lại với BE tại merge point M1.
 */

export type WorkingMode = "fast" | "coaching";

export interface ReleaseScope {
  in: string[];
  out: string[];
}

export interface SpineProject {
  name: string;
  vision: string;
  goals: string[];
  type: string;
  domain: string;
  complexity: string;
  form_factor: string;
  stakes: string;
  working_mode: WorkingMode;
  release_scope: ReleaseScope;
}

export interface SpineSession {
  id: string;
  is_pipeline: boolean;
}

export interface Progress {
  current_phase: string;
  current_step: string;
  screen_cursor: string | null;
  screen_queue: string[];
  elicit_turns_this_phase: number;
}

export type StepStatus = "pending" | "in_progress" | "accepted" | "revision_requested";

export interface StepState {
  id: string;
  status: StepStatus;
  first_seq: number | null;
  last_seq: number | null;
  accepted_at: string | null;
}

export interface Feature {
  id: string;
  name: string;
  order: number;
}

export type ActorKind = "human" | "system" | "time";

export interface Actor {
  id: string;
  name: string;
  kind: ActorKind;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  actor_id: string | null;
}

export interface UseCase {
  id: string;
  name: string;
  actor_ids: string[];
  function_ids: string[];
  description: string;
  includes: string[];
  extends: string[];
}

export type ScreenDetailStatus = "pending" | "in_progress" | "signed_off" | "placeholder";

export interface Screen {
  id: string;
  feature_id: string;
  name: string;
  description: string;
  flow_to: string[];
  is_popup: boolean;
  tabs: string[];
  primary_function_id: string | null;
  queue_order: number;
  detail_status: ScreenDetailStatus;
}

export interface Permission {
  id: string;
  screen_id: string;
  role_id: string;
  action: string;
}

export interface Entity {
  id: string;
  name: string;
  description: string;
  relations: string[];
}

export type ValidationKind = "business" | "format" | "required";

export interface Validation {
  id: string;
  kind: ValidationKind;
  statement: string;
}

/** `functions[]` của Spine (BE đặt tên `Function`; FE đổi tên để không che kiểu global `Function`). */
export interface SpineFunction {
  id: string;
  screen_id: string | null;
  feature_id: string;
  order: number;
  name: string;
  trigger: string;
  description: string;
  normal: string[];
  abnormal: string[];
  validations: Validation[];
  business_rule_ids: string[];
  priority: string | null;
}

export type NfrCategory = "interface" | "usability" | "reliability" | "performance" | "other";
export type NfrKind = "quantitative" | "descriptive";

export interface Nfr {
  id: string;
  category: NfrCategory;
  statement: string;
  kind: NfrKind;
  metric?: string;
  threshold?: string;
  priority: string | null;
}

export type BusinessRuleTier = "high" | "detail";

export interface BusinessRule {
  id: string;
  tier: BusinessRuleTier;
  statement: string;
  source_validation_ids: string[];
}

export interface CommonRequirement {
  id: string;
  category: string;
  statement: string;
}

export interface Message {
  id: string;
  code: string;
  text: string;
  function_ids: string[];
}

export type OtherRequirementKind = "risk" | "assumption" | "open_question" | "technical_risk";

export interface OtherRequirement {
  id: string;
  kind: OtherRequirementKind;
  statement: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  term_native?: string;
  definition: string;
}

export interface Addendum {
  id: string;
  topic: string;
  content: string;
  content_en: string;
  target_section: string;
  captured_at: string;
}

export type DiagramKind = "context" | "usecase" | "screen_flow" | "erd" | "screen_layout";

export interface Diagram {
  id: string;
  kind: DiagramKind;
  puml: string;
  section: string;
  owner_kind: string;
  owner_id: string;
  render_status: "ok" | "error";
  error?: string;
  source_hash: string;
  rendered_at: string;
}

export type AssumptionStatus = "unconfirmed" | "confirmed" | "rejected";

export interface Assumption {
  id: string;
  path: string;
  statement: string;
  rationale: string;
  origin_step_id: string;
  status: AssumptionStatus;
  confirmed_at: string | null;
}

export type FlagLevel = "red" | "yellow";

/** 10 luật cờ đỏ tất định (`srs-spine.md` §7). */
export type RedFlagRuleId =
  | "section_empty"
  | "array_empty"
  | "dead_reference"
  | "render_error"
  | "diagram_stale"
  | "nfr_missing_number"
  | "unconfirmed_assumption"
  | "section_stale_at_baseline"
  | "section_awaiting_reaccept"
  | "screen_pending_at_baseline";

/** 6 luật cờ vàng cardinality (`srs-spine.md` §8.1). */
export type YellowFlagRuleId =
  | "orphan_actor"
  | "usecase_no_function"
  | "screen_no_function"
  | "empty_feature"
  | "role_no_actor"
  | "non_english_content";

export type FlagRuleId = RedFlagRuleId | YellowFlagRuleId;

export interface Flag {
  id: string;
  level: FlagLevel;
  rule_id: FlagRuleId;
  section_id: string;
  target_id?: string | null;
  message: string;
  remediation_step: string;
  opened_at_version: number;
  resolved_at: string | null;
  waived_by_user: string | null;
  waive_reason: string | null;
  waived_at_version: number | null;
}

/** `sections[]` chỉ lưu `asset_version`; status là hàm tính ở BE (`srs-spine.md` §5). */
export interface SectionState {
  id: string;
  asset_version: string;
}

export interface Baseline {
  id: string;
  version: string;
  at: string;
  snapshot_ref: string;
  checked_at_version: number;
  waived_count: number;
}

/** Loại op (`op.types.ts` của T08) và `revert` do undo ghi lại. */
export type OpKind = "set" | "add" | "remove" | "renumber" | "clone" | "migrate" | "revert";

/** Một dòng lịch sử ghi — BE lưu ở collection riêng, đọc qua `GET /projects/:id/changes`. */
export interface Change {
  seq: number;
  txn: string;
  op: OpKind;
  path: string;
  before: unknown;
  value: unknown;
  reason?: string;
  at: string;
  by: string;
  step_id?: string;
}

export type UsageState = "reserved" | "deducted" | "refunded";

/** Một lần gọi model — BE lưu ở collection riêng. */
export interface Usage {
  id: string;
  step_id: string;
  call_kind: string;
  attempt: number;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  state: UsageState;
  expires_at: string;
}

/** Document Spine của một project. `changes[]` và `usage[]` tách collection nên không nằm ở đây. */
export interface Spine {
  projectId: string;
  spine_version: number;
  project: SpineProject;
  sessions: SpineSession[];
  progress: Progress;
  steps: StepState[];
  features: Feature[];
  actors: Actor[];
  roles: Role[];
  use_cases: UseCase[];
  screens: Screen[];
  permissions: Permission[];
  entities: Entity[];
  functions: SpineFunction[];
  nfrs: Nfr[];
  business_rules: BusinessRule[];
  common_requirements: CommonRequirement[];
  messages: Message[];
  other_requirements: OtherRequirement[];
  glossary: GlossaryTerm[];
  addendum: Addendum[];
  diagrams: Diagram[];
  assumptions: Assumption[];
  flags: Flag[];
  sections: SectionState[];
  baselines: Baseline[];
}
