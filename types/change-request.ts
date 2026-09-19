/**
 * Change request mode 1 — bám `flintflow_be/src/modules/change-request/change-request.dto.ts` (FLF-171).
 * Tên `Cr*` để không trùng `ChangeRequest` của `types/pipeline.ts` (body `POST /changes` ở mode 2).
 */
import type { DocBlock, Paused } from "./import";
import type { IsoDateTime } from "./spine";

export const CR_STATUSES = [
  "draft",
  "clarifying",
  "awaiting_answers",
  "impact_review",
  "proposing",
  "verifying",
  "manual_fix",
  "ready_to_submit",
  "in_review",
  "written",
  "rejected",
  "cancelled",
] as const;
export type CrStatus = (typeof CR_STATUSES)[number];

export const CR_TERMINAL_STATUSES: readonly CrStatus[] = ["written", "rejected", "cancelled"];
/** Trạng thái CR đang giữ khoá block (BE `CR_STATUSES_HOLDING_LOCKS`). */
export const CR_LOCKING_STATUSES: readonly CrStatus[] = ["impact_review", "proposing", "verifying", "manual_fix", "ready_to_submit", "in_review"];

export type CrSourceKind = "stakeholder_email" | "meeting_minutes" | "gap_report" | "reupload" | "viewer_comment" | "verbal";

export interface CrSource {
  kind: CrSourceKind;
  ref: string | null;
  note: string | null;
}

export interface Cr {
  cr_id: string;
  project_id: string;
  title: string;
  description: string;
  source: CrSource;
  requester: string;
  status: CrStatus;
  paused: Paused | null;
  clarifications: { round: number; questions: string[]; answers: string[] }[];
  base_doc_version: string;
  result_doc_version: string | null;
  created_by: string;
  submitted_at: IsoDateTime | null;
  decided_by: string | null;
  closed_reason: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export type LocationFoundBy = "spine_link" | "mention" | "keyword";
export type LocationConclusion = "edit" | "comment" | "not_related";

export interface CrLocation {
  location_id: string;
  block_id: string;
  block: DocBlock | null;
  found_by: LocationFoundBy[];
  entity_paths: string[];
  owner_step: string | null;
  conclusion: LocationConclusion | null;
  reason: string | null;
  proposal: { old_text: string; new_text: string | null; comment_text: string | null; spine_ops: unknown[] } | null;
  manual: boolean;
  redo_count: number;
  verify: {
    code_ok: boolean;
    violations: { rule: string; message: string; path?: string }[];
    ai_flags: { rule: string; message: string }[];
    at: IsoDateTime;
  } | null;
  group_id: string | null;
}

export type GroupDecision = "pending" | "approved" | "rejected";

export interface CrGroup {
  group_id: string;
  title: string;
  location_ids: string[];
  decision: GroupDecision;
  reason: string | null;
  decided_by: string | null;
  decided_at: IsoDateTime | null;
}

export interface CrDetail {
  change_request: Cr;
  locations: CrLocation[];
  groups: CrGroup[];
  pending_questions: string[];
}

/** Lý do từ chối group / đóng / huỷ tối thiểu (BE `DECISION_REASON_MIN_LENGTH`). */
export const DECISION_REASON_MIN_LENGTH = 10;
export const MAX_REDO_PER_LOCATION = 2;
export const MAX_CLARIFY_ROUNDS = 3;

// ─── request ─────────────────────────────────────────────────────

export interface CreateCrRequest {
  title: string;
  description: string;
  source: { kind: CrSourceKind; ref?: string | null; note?: string | null };
  requester: string;
}

export interface AnswersRequest {
  answers: string[];
}

export interface PatchLocationRequest {
  conclusion?: LocationConclusion;
  reason?: string;
  new_text?: string;
  comment_text?: string;
}

export interface GroupDecisionRequest {
  decision: "approved" | "rejected";
  reason?: string;
  base_version: number;
}

export interface CloseCrRequest {
  reason: string;
}

// ─── meta lỗi ────────────────────────────────────────────────────

/** 409 BLOCK_LOCKED */
export interface BlockLockedMeta {
  locked: { block_id: string; cr_id: string }[];
}

/** 409 CHANGE_REQUIRES_CR — chat / `POST /changes` / `POST /undo` ở project mode 1: mở form CR điền sẵn. */
export interface ChangeRequiresCrMeta {
  prefill: { title: string; description: string };
}

/** 409 CR_LOCATION_UNCONCLUDED */
export interface LocationUnconcludedMeta {
  location_ids: string[];
}

/** Mã lỗi mode 1 (`docs/api/import-change-contract.md` §0.3). */
export type Mode1ErrorCode =
  | "CR_SOURCE_REQUIRED"
  | "IMPORT_NOT_FOUND"
  | "DOC_VERSION_NOT_FOUND"
  | "CR_NOT_FOUND"
  | "CR_LOCATION_NOT_FOUND"
  | "CR_GROUP_NOT_FOUND"
  | "PROJECT_MODE_MISMATCH"
  | "IMPORT_NEEDS_LATEST_CONFIRM"
  | "IMPORT_INVALID_STATE"
  | "CR_REQUIRES_BASELINE"
  | "CR_INVALID_TRANSITION"
  | "BLOCK_LOCKED"
  | "CR_LOCATION_UNCONCLUDED"
  | "CR_OLD_TEXT_MISMATCH"
  | "CHANGE_REQUIRES_CR"
  | "IMPORT_FILE_REJECTED"
  | "IMPORT_STAMP_FOREIGN_PROJECT"
  | "RELEASE_RED_FLAGS_OPEN";
