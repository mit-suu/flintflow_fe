/**
 * Kiểu hợp đồng Pipeline API — ĐỒNG BỘ TAY với BE `docs/api/pipeline-contract.md` và
 * `src/modules/pipeline/pipeline.dto.ts` (T08, đóng băng tại M2).
 */
import type { SectionStatus } from "./document";
import type { Change, Spine, StepStatus } from "./spine";

// ─── changes ─────────────────────────────────────────────────────

export type UserOpKind = "set" | "add" | "remove" | "renumber";

export interface Op {
  op: UserOpKind;
  path: string;
  value?: unknown;
  reason?: string;
}

/** Body `POST /projects/:id/changes` và `/changes/preview` — đúng một trong `ops` / `instruction`. */
export interface ChangeRequest {
  base_version: number;
  ops?: Op[];
  instruction?: string;
  reason?: string;
  preview_id?: string;
}

export interface Violation {
  rule: string;
  message: string;
  path?: string;
  op_index?: number;
}

export interface Referrer {
  path: string;
  id: string;
}

export interface ChangeDiff {
  op: string;
  path: string;
  before: unknown;
  value: unknown;
  reason: string | null;
}

export interface Impact {
  fields: string[];
  sections: { id: string; relation: "owner" | "reads" | "derived" }[];
  diagrams: string[];
  referrers: Referrer[];
}

/** `POST /projects/:id/changes/preview` — 200 cả khi `ok = false`. */
export interface PreviewResult {
  ok: boolean;
  txn: string;
  base_version: number;
  ops: Op[];
  changes: ChangeDiff[];
  violations: Violation[];
  referrers: Referrer[];
  branch?: "silent" | "dependent" | "post_baseline";
  impact?: Impact;
  clarification?: string;
  preview_id?: string;
}

/** `POST /projects/:id/changes`, `/undo`, `/reconcile`. */
export interface ApplyResult {
  /** null ⇒ lô không đổi gì: không ghi change, `spine_version` giữ nguyên. */
  txn: string | null;
  spine_version: number;
  changes: Change[];
  spine: Spine;
}

// ─── steps ───────────────────────────────────────────────────────

export type StepKind = "soft" | "fixed" | "loop" | "gate";

export type GateAction = "accept" | "revision" | "regenerate" | "accept_as_is";

export interface StepSummary {
  id: string;
  phase: string;
  label_vi: string;
  label_en: string;
  kind: StepKind;
  status: StepStatus;
  deterministic: boolean;
  calls_used: number;
  calls_limit: 8;
  regenerate_used: number;
  regenerate_limit: 3;
  accepted_at: string | null;
  /** Step đang chạy dở ở một request khác (vd tab cũ chưa xong sau khi reload) — khoá nút chạy thay vì để nhận 409. */
  running: boolean;
}

/** `GET /projects/:id/steps`. */
export interface StepsResponse {
  current_phase: string | null;
  current_step: string | null;
  steps: StepSummary[];
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  multiple?: boolean;
}

export type PipelineErrorCode =
  | "VALIDATION_ERROR"
  | "FLAG_NOT_WAIVABLE"
  | "UNAUTHORIZED"
  | "INSUFFICIENT_CREDIT"
  | "NOT_PIPELINE_SESSION"
  | "PROJECT_NOT_FOUND"
  | "SPINE_NOT_FOUND"
  | "STEP_NOT_FOUND"
  | "FLAG_NOT_FOUND"
  | "BASELINE_NOT_FOUND"
  | "DIAGRAM_NOT_FOUND"
  | "SPINE_VERSION_CONFLICT"
  | "NEEDS_USER_INPUT"
  | "NEEDS_CLARIFICATION"
  | "REGENERATE_LIMIT"
  | "CALL_LIMIT"
  | "STEP_NOT_RUNNABLE"
  | "NO_WORKING_DRAFT"
  | "INVARIANT_VIOLATION"
  | "OP_INVALID"
  | "CHANGE_RANGE_INVALID"
  | "NOTHING_TO_UNDO"
  | "BASELINE_BLOCKED"
  | "RATE_LIMIT_EXCEEDED"
  | "AI_PROVIDER_ERROR"
  | "NOT_IMPLEMENTED";

/** Sự kiện SSE của `POST /projects/:id/steps/:stepId/run` (`event: <type>` + `data: <JSON>`). */
export type StepEvent =
  | { type: "intake"; step_id: string; phase: string; empty_fields: string[] }
  | { type: "elicit"; step_id: string; delta: string }
  | { type: "answer_needed"; step_id: string; questions: Question[] }
  | { type: "draft"; step_id: string; attempt: number }
  | { type: "ops_applied"; step_id: string; txn: string; spine_version: number; changes: ChangeDiff[] }
  | { type: "render"; step_id: string; diagram_id: string; render_status: "ok" | "error"; error?: string }
  | { type: "flags"; step_id: string; red_open: number; yellow_open: number }
  | { type: "gate_ready"; step_id: string; actions: GateAction[]; regenerate_used: number; calls_used: number }
  | { type: "error"; step_id: string; code: PipelineErrorCode; message: string; retryable: boolean };

export type StepEventType = StepEvent["type"];

export interface RunStepRequest {
  session_id: string;
  base_version: number;
}

export interface StepAnswer {
  question_id: string;
  answer: string | string[];
}

export interface StepAnswerRequest {
  session_id: string;
  answers: StepAnswer[];
}

/** `revision` và `accept_as_is` bắt buộc `note`. `session_id` bắt buộc (contract-change 2026-09-15). */
export interface GateRequest {
  session_id: string;
  action: GateAction;
  note?: string;
  base_version: number;
  function_id?: string;
}

/** `POST /projects/:id/resume` (endpoint 24): step `in_progress` dang dở bị revert về `pending`. */
export interface ResumeResponse {
  reverted_step: string | null;
  spine_version: number;
  progress: ProgressResponse;
}

export interface GateResponse {
  step: StepSummary;
  next_step: string | null;
  spine_version: number;
}

// ─── progress ────────────────────────────────────────────────────

export interface Readiness {
  accepted_pct: number;
  awaiting_reaccept: number;
  red_open: number;
  stale: number;
}

export interface StepProgress {
  done: number;
  total: number;
  current_phase: string | null;
  current_step: string | null;
  show_percent: boolean;
}

export interface SectionProgress {
  id: string;
  status: SectionStatus;
  awaiting_reaccept: boolean;
  required: boolean;
  derived: boolean;
}

/** `GET /projects/:id/progress`. */
export interface ProgressResponse {
  readiness: Readiness;
  progress: StepProgress;
  sections: SectionProgress[];
}
