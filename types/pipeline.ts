/**
 * Kiểu hợp đồng Pipeline API — theo danh sách endpoint của T08; chốt lại theo
 * `docs/api/pipeline-contract.md` + `pipeline.dto.ts` khi T08 merge (T12 cập nhật).
 */
import type { SectionStatus } from "./document";
import type { Change, OpKind, Spine, StepStatus } from "./spine";

export interface Op {
  op: OpKind;
  path: string;
  value?: unknown;
  reason?: string;
}

/** Body `POST /projects/:id/changes` và `/changes/preview`. */
export interface ChangeRequest {
  instruction?: string;
  ops?: Op[];
  base_version: number;
}

export interface ApplyResult {
  spine: Spine;
  changes: Change[];
  spine_version: number;
}

export type StepKind = "soft" | "fixed" | "loop" | "gate";

export interface StepSummary {
  id: string;
  phase: string;
  label_vi: string;
  label_en: string;
  kind: StepKind;
  status: StepStatus;
}

/** Sự kiện SSE của `POST /projects/:id/steps/:stepId/run`. */
export type StepEventType =
  | "intake"
  | "elicit"
  | "answer_needed"
  | "draft"
  | "ops_applied"
  | "render"
  | "flags"
  | "gate_ready"
  | "error";

export interface StepEvent {
  type: StepEventType;
  data?: unknown;
}

export type StepAnswers = Record<string, string | string[]>;

export type GateAction = "accept" | "revision" | "regenerate" | "accept_as_is";

export interface GateRequest {
  action: GateAction;
  note?: string;
}

export interface Readiness {
  acceptedPct: number;
  awaitingReaccept: number;
  redOpen: number;
  stale: number;
}

export interface StepProgress {
  done: number;
  total: number;
  currentPhase: string;
  currentStep: string;
  showPercent: boolean;
}

export interface SectionProgress {
  id: string;
  status: SectionStatus;
  awaiting_reaccept: boolean;
}

/** `GET /projects/:id/progress`. */
export interface ProgressResponse {
  readiness: Readiness;
  steps: StepProgress;
  sections: SectionProgress[];
}

export type PipelineErrorCode =
  | "SPINE_VERSION_CONFLICT"
  | "INVARIANT_VIOLATION"
  | "NEEDS_USER_INPUT"
  | "NEEDS_CLARIFICATION"
  | "REGENERATE_LIMIT"
  | "CALL_LIMIT"
  | "INSUFFICIENT_CREDIT"
  | "NOT_PIPELINE_SESSION";
