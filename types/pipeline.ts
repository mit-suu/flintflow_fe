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
  /** Phiên chat nơi gõ lệnh sửa — BE đọc đuôi hội thoại và ghi lượt sửa vào phiên (contract-change 2026-09-28). */
  session_id?: string;
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
  notes?: string;
  /** Hoà giải: không có gì cần đổi — xác nhận nguyên trạng để gỡ cờ "đã cũ" (BUG-16). */
  no_change?: boolean;
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

/** Một lựa chọn của thẻ hỏi (theo AskUserQuestion). "Khác…" không nằm ở đây — FE tự thêm. */
export interface QuestionOption {
  label: string;
  /** Chọn phương án này được/mất gì. */
  description?: string;
  /** Bản so sánh monospace (bố cục màn, cấu trúc bảng). */
  preview?: string;
}

/**
 * Câu hỏi trong `answer_needed` / run-state. Không có `options` ⇒ câu mở, trả lời bằng ô chat.
 * `options` dạng `string` chỉ còn ở run-state cũ (trước FLF-220) — đọc qua `normalizeOption`.
 */
export interface Question {
  id: string;
  text: string;
  /** Nhãn tab ≤ 12 ký tự. */
  header?: string;
  options?: Array<string | QuestionOption>;
  multiple?: boolean;
  /** Câu mở đã hỏi ngay trong lời AI (`reply`) — không render thành thẻ/dòng riêng, nhưng vẫn trả lời được bằng ô chat. */
  inline?: boolean;
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

/** Giai đoạn của một lượt chạy step — nhãn ở `STAGE_ORDER` (`_components/StepProgress.tsx`). */
export type RunStage = "intake" | "ask" | "draft" | "check" | "render" | "gate";

/** Một dòng tóm tắt thay đổi đọc được cho người (WP-5), dùng ở "Vừa ghi" và ở gate. */
export interface ChangeSummary {
  kind: "add" | "update" | "remove";
  collection: string;
  id: string | null;
  title_vi: string;
  section_id?: string | null;
}

export interface AssumptionBrief {
  id: string;
  /** `statement` (EN, vào SRS). */
  text: string;
  /** `statement_vi` — bản ngôn ngữ user (FLF-221); BE cũ / dữ liệu cũ không có. */
  text_vi?: string;
  conflict?: string | null;
}

/** Bảng thu gọn hiện ngay ở gate (MoSCoW ở S-9.4, ma trận quyền ở S-4.3) — BUG-20. */
export interface GateTable {
  title_vi: string;
  columns: string[];
  rows: string[][];
  truncated: number;
}

export interface GateReadyEvent {
  type: "gate_ready";
  step_id: string;
  actions: GateAction[];
  regenerate_used: number;
  calls_used: number;
  summary?: ChangeSummary[];
  new_assumptions?: AssumptionBrief[];
  flags?: { red: number; yellow: number; red_delta: number; yellow_delta: number };
  duration_ms?: number;
  credits_used?: number;
  doc_progress?: { before: number; after: number };
  table?: GateTable;
  no_change_reason?: string;
  /** Version CUỐI của lượt chạy — cao hơn `ops_applied` vì render + recompute cờ chạy sau (L11). */
  spine_version?: number;
  /** Lượt chạy có ghi được op nào không (L11b) — `false` = model trả lô rỗng. */
  wrote_ops?: boolean;
  /** Mục step này nuôi mà chạy xong vẫn trống (L11b). Cả ba để optional vì BE cũ hơn không gửi. */
  empty_sections?: { section_id: string; title: string }[];
  /** Lời AI ở cổng chốt (2–4 câu, tiếng Việt). Vắng ở dự án cũ ⇒ FE dựng câu tạm từ `summary`. */
  message_vi?: string;
  /**
   * Bước im trong lượt chạy liền giai đoạn: server tự Accept ngay — không phải cổng chờ user, không dựng thẻ cổng/chip.
   * Vắng ⇒ cổng thật.
   */
  auto?: boolean;
}

/** Sự kiện SSE của `POST /projects/:id/steps/:stepId/run` (`event: <type>` + `data: <JSON>`). */
export type StepEvent =
  | { type: "intake"; step_id: string; phase: string; empty_fields: string[] }
  | { type: "elicit"; step_id: string; delta: string }
  | { type: "answer_needed"; step_id: string; questions: Question[] }
  | { type: "answer_received"; step_id: string; count: number }
  | { type: "draft"; step_id: string; attempt: number }
  | { type: "draft_retry"; step_id: string; attempt: number; max: number; reason_vi: string }
  | { type: "stage"; step_id: string; stage: RunStage; label_vi: string; detail_vi?: string; batch?: { i: number; n: number }; est_ms?: number }
  | { type: "heartbeat"; step_id: string; stage: RunStage; elapsed_ms: number }
  | {
      type: "ops_applied";
      step_id: string;
      txn: string;
      spine_version: number;
      changes: ChangeDiff[];
      summary?: ChangeSummary[];
    }
  | { type: "render"; step_id: string; diagram_id: string; render_status: "ok" | "error"; error?: string }
  | {
      type: "flags";
      step_id: string;
      red_open: number;
      yellow_open: number;
      red_delta?: number;
      yellow_delta?: number;
      new_assumptions?: AssumptionBrief[];
    }
  | GateReadyEvent
  | { type: "auto_accepted"; step_id: string; reason_vi: string }
  | { type: "phase_progress"; step_id: string; phase: string; step_index: number; step_total: number; needs_user: boolean }
  | {
      type: "phase_gate";
      step_id: string;
      phase: string;
      reason_vi: string;
      /** Tóm tắt của CẢ giai đoạn, gồm cả bước đã tự Accept. */
      summary: ChangeSummary[];
      new_assumptions: AssumptionBrief[];
      steps: { step_id: string; label_vi: string; auto_accepted: boolean }[];
      flags?: { red: number; yellow: number; red_delta: number; yellow_delta: number };
      /** Lời AI ở cổng chốt cuối giai đoạn; vắng ở dự án cũ. */
      message_vi?: string;
    }
  | { type: "error"; step_id: string; code: PipelineErrorCode; message: string; retryable: boolean };

export type PhaseGateEvent = Extract<StepEvent, { type: "phase_gate" }>;

/** `GET /projects/:id/steps/:stepId/run-state` và `GET /projects/:id/run-state/active`. */
export interface RunState {
  step_id: string;
  run_id: string;
  status: "running" | "waiting_answer" | "gate" | "done" | "interrupted" | "cancelled";
  stage: RunStage;
  detail_vi: string | null;
  batch: { i: number; n: number } | null;
  started_at: string;
  last_event_at: string;
  /** Lượt còn sống (khoá chưa hết hạn). `false` ⇒ lượt đã chết giữa chừng, phải chạy lại. */
  alive: boolean;
  questions: Question[] | null;
  gate_payload: GateReadyEvent | null;
  /** Cổng chốt cuối giai đoạn (tin nhắn + mọi giả định của giai đoạn) — dựng lại đúng cổng sau reload. Vắng/null ⇒ bước lẻ. */
  phase_gate?: PhaseGateEvent | null;
  /** Mỗi sự kiện lưu kèm `at` (ISO, FLF-221) — dữ liệu cũ không có. */
  events: (StepEvent & { at?: string })[];
  error: { code: string; message: string } | null;
}

export type StepEventType = StepEvent["type"];

export interface RunStepRequest {
  session_id: string;
  base_version: number;
  /** Chạy lại step đã chốt (B7 reopen) — BE đặt lại `revision_requested` rồi chạy như thường. */
  reopen?: boolean;
  /** Tin chat khởi động lượt chạy (FLF-221: chat là nút chạy) — BE ghi vào transcript của step. */
  message?: string;
  /** `no_idea`: chip "Mình chưa có ý tưởng" — B-0.1 hỏi gợi mở, không đưa lựa chọn. */
  intent?: RunIntent;
}

export type RunIntent = "no_idea";

export interface StepAnswer {
  question_id: string;
  answer: string | string[];
}

export interface StepAnswerRequest {
  session_id: string;
  /** Được rỗng khi có `message` (FLF-221). */
  answers: StepAnswer[];
  /** Chat tự do khi đang chờ trả lời: AI chốt câu nào được trả lời đúng ý, nhắc câu còn chờ. */
  message?: string;
}

/** `PATCH /projects/:id/assumptions/:assumptionId` (FLF-221) — AI dịch `statement_vi` sang `statement`. */
export interface AssumptionEditRequest {
  statement_vi: string;
  base_version: number;
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
  /** Sau `revision`: lời AI nói đã sửa gì (vắng khi BE không có gì để nói). */
  message_vi?: string;
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
