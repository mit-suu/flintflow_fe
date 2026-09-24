/**
 * Change request mode 1 — bám `flintflow_be/src/modules/change-request/change-request.dto.ts` (FLF-171).
 * Tên `Cr*` để không trùng `ChangeRequest` của `types/pipeline.ts` (body `POST /changes` ở mode 2).
 */
import type { Paused } from "./import";
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
/** Trạng thái CR đang giữ khoá phần tử Spine (BE `CR_STATUSES_HOLDING_LOCKS`). */
export const CR_LOCKING_STATUSES: readonly CrStatus[] = ["impact_review", "proposing", "verifying", "manual_fix", "ready_to_submit", "in_review"];

/**
 * `chat` (FLF-182): chỉ còn ở CR cũ. Mode 1 v3 (BPMN 3.1): tạo CR mới chỉ nhận 6 nguồn `NEW_CR_SOURCE_KINDS` — lệnh
 * sửa trong chat là yêu cầu miệng (`verbal`, `ref: chat:<id>`).
 */
export type CrSourceKind = "stakeholder_email" | "meeting_minutes" | "gap_report" | "reupload" | "viewer_comment" | "verbal" | "chat";

/** Nguồn nhận khi tạo CR (BE `NEW_CR_SOURCE_KINDS`) — đúng 6 nguồn BPMN 3.1. */
export const NEW_CR_SOURCE_KINDS = ["stakeholder_email", "meeting_minutes", "gap_report", "reupload", "viewer_comment", "verbal"] as const satisfies readonly CrSourceKind[];

/** Mode 1 v3: bản xem trước đính kèm lúc tạo CR — gợi ý cho C-2/C-3/C-4. */
export interface CrSeed {
  instruction: string | null;
  ops: Record<string, unknown>[];
  /** Phần tử Spine bị op chạm. */
  targets: string[];
}

/**
 * Tài liệu bổ sung của CR (mode 1 v3 phase 7): chữ người dùng dán / tách từ file / Gemini đọc từ ảnh — AI dùng làm
 * dữ kiện ở 3.2, 3.6, 3.9. `round` 0 = đính kèm lúc tạo, n = khi trả lời vòng n.
 */
export const CR_MATERIAL_KINDS = ["text", "file", "image"] as const;
export type CrMaterialKind = (typeof CR_MATERIAL_KINDS)[number];
export const CR_MAX_MATERIALS = 10;
/** Đuôi file BE nhận làm tài liệu bổ sung. */
export const CR_MATERIAL_ACCEPT = ".docx,.pdf,.txt,.md,.png,.jpg,.jpeg";

export interface CrMaterial {
  material_id: string;
  kind: CrMaterialKind;
  name: string;
  text: string;
  truncated: boolean;
  round: number;
  added_at: IsoDateTime;
}

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
  /** `suggestions` (phase 7): đáp án AI gợi ý, song song `questions` (`[]` khi không có). */
  clarifications: { round: number; questions: string[]; answers: string[]; suggestions: string[][] }[];
  base_doc_version: string;
  result_doc_version: string | null;
  created_by: string;
  submitted_at: IsoDateTime | null;
  decided_by: string | null;
  closed_reason: string | null;
  seed: CrSeed | null;
  materials: CrMaterial[];
  /** Phase 7: dữ kiện 3.2 báo vẫn thiếu khi buộc đi tiếp — 3.6 viết kèm giả định. */
  missing_info: string[];
  /** Phase 8: lệnh sửa gộp thêm từ chat (theo thứ tự). */
  amendments: { text: string; at: IsoDateTime }[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `preview` (mode 1 v3): phần tử bị op của bản xem trước đính kèm CR chạm tới. */
export type LocationFoundBy = "spine_link" | "mention" | "keyword" | "preview";
export type LocationConclusion = "edit" | "comment" | "not_related";

/**
 * Vị trí CR — mode 1 v2 (FLF-186): phần tử Spine (`path`, vd `nfrs[id=NFR-01]`) + section hiển thị nó, thay block docx.
 * `current_text` / `proposal.old_text` / `proposal.new_text` là giá trị phần tử dạng JSON (khoá sắp xếp).
 */
export interface CrLocation {
  location_id: string;
  path: string;
  section_id: string;
  section_title: string;
  current_text: string;
  found_by: LocationFoundBy[];
  entity_paths: string[];
  owner_step: string | null;
  conclusion: LocationConclusion | null;
  reason: string | null;
  proposal: {
    old_text: string;
    new_text: string | null;
    comment_text: string | null;
    spine_ops: unknown[];
    /** Phase 7: dữ kiện AI tự giả định — người duyệt cần xác nhận. */
    assumptions: string[];
  } | null;
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

/** Lý do quyết định group (duyệt lẫn từ chối — BPMN 3.12, mode 1 v3) / đóng / huỷ tối thiểu (BE `DECISION_REASON_MIN_LENGTH`). */
export const DECISION_REASON_MIN_LENGTH = 10;
export const MAX_REDO_PER_LOCATION = 2;
export const MAX_CLARIFY_ROUNDS = 3;

/** Phase 8: CR chưa nộp — chat còn gộp lệnh / dẫn từng bước được. */
export const CR_OPEN_STATUSES: readonly CrStatus[] = ["draft", "clarifying", "awaiting_answers", "impact_review", "proposing", "verifying", "manual_fix", "ready_to_submit"];
/** Phase 8: trạng thái BE nhận `POST …/amend`. */
export const CR_AMENDABLE_STATUSES: readonly CrStatus[] = ["draft", "impact_review", "proposing", "verifying", "manual_fix", "ready_to_submit"];
/** Phase 8: trạng thái BE nhận "Sửa lại" một vị trí (`owner-step-draft`). */
export const CR_REDRAFT_STATUSES: readonly CrStatus[] = ["proposing", "verifying", "manual_fix", "ready_to_submit"];

// ─── request ─────────────────────────────────────────────────────

export interface CreateCrRequest {
  title: string;
  description: string;
  source: { kind: (typeof NEW_CR_SOURCE_KINDS)[number]; ref?: string | null; note?: string | null };
  requester: string;
  /** Mode 1 v3: bản xem trước (`POST /changes/preview`) đính kèm làm gợi ý. Hết hạn ⇒ CR vẫn tạo, `meta.seed_dropped`. */
  preview_id?: string;
  /** Phase 7: đoạn văn bản nguồn dán ở 3.1 (≤ 5). File upload sau khi tạo qua `addCrMaterialFile`. */
  materials?: { name: string; text: string }[];
}

/** `POST …/locations/:locId/owner-step-draft` (BPMN 3.9) — hướng sửa của BA cho skill step sở hữu. */
export interface OwnerStepDraftRequest {
  instruction: string;
}

export interface AnswersRequest {
  answers: string[];
}

export interface PatchLocationRequest {
  conclusion?: LocationConclusion;
  reason?: string;
  /** FLF-186: giá trị mới của cả phần tử ⇒ op `set` tại `path`. */
  new_value?: unknown;
  /** FLF-186: op Spine tự viết thay `new_value`. */
  spine_ops?: Record<string, unknown>[];
  comment_text?: string;
}

export interface GroupDecisionRequest {
  decision: "approved" | "rejected";
  /** Bắt buộc cả khi duyệt (BPMN 3.12, mode 1 v3), ≥ `DECISION_REASON_MIN_LENGTH`. */
  reason: string;
  base_version: number;
}

export interface CloseCrRequest {
  reason: string;
}

// ─── meta lỗi ────────────────────────────────────────────────────

/** 409 PATH_LOCKED (FLF-186) — phần tử Spine nào đang bị CR nào giữ. */
export interface PathLockedMeta {
  locked: { path: string; cr_id: string }[];
}

/**
 * 409 CHANGE_REQUIRES_CR — project mode 1 đã import (mode 1 v3, BPMN 3.1): lời gọi có ghi (`/changes`, `/reconcile`,
 * `/undo`) và lệnh sửa trong chat ⇒ **không** tạo CR, chỉ trả nội dung điền sẵn cho form 3.1 (BA chọn lại nguồn).
 */
export interface ChangeRequiresCrMeta {
  prefill: { title: string; description: string; source?: { kind: CrSourceKind; ref: string | null } };
}

/** 409 CR_LOCATION_UNCONCLUDED */
export interface LocationUnconcludedMeta {
  location_ids: string[];
}

/**
 * 409 CR_NO_LOCATIONS — C-3 không tìm được phần tử Spine nào. `empty_sections`: đích của C-2 là mục còn trống
 * (không có gì để sửa — chạy `step_id` để AI soạn nội dung; mục riêng thì `step_id = null`).
 */
export interface CrNoLocationsMeta {
  targets: { entity_paths: string[]; keywords: string[] };
  empty_sections: { section_id: string; title: string; step_id: string | null }[];
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
  | "PATH_LOCKED"
  | "CR_LOCATION_UNCONCLUDED"
  | "CR_NO_LOCATIONS"
  | "CR_NOTHING_TO_APPROVE"
  | "CR_VALUE_CHANGED"
  | "CHANGE_REQUIRES_CR"
  | "IMPORT_FILE_REJECTED"
  | "IMPORT_STAMP_FOREIGN_PROJECT"
  | "RELEASE_RED_FLAGS_OPEN";
