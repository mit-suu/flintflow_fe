/**
 * Step pipeline — theo `docs/api/pipeline-contract.md` (T08) mục 1 và 2.
 */
import type {
  GateRequest,
  GateResponse,
  ProgressResponse,
  ResumeResponse,
  RunState,
  RunStepRequest,
  StepAnswerRequest,
  StepEvent,
  StepsResponse,
} from "@/types/pipeline";
import { streamSse, type SseHandlers } from "../ai-stream";
import { apiCall } from "./client";

export const getProgress = (projectId: string) =>
  apiCall<ProgressResponse>(`/projects/${projectId}/progress`);

export const listSteps = (projectId: string) =>
  apiCall<StepsResponse>(`/projects/${projectId}/steps`);

/** Chạy một step; BE trả luồng SSE các `StepEvent`, đóng sau `gate_ready` hoặc `error`. */
export const runStep = (
  projectId: string,
  stepId: string,
  request: RunStepRequest,
  handlers: SseHandlers<StepEvent>
) => streamSse<StepEvent>(`/projects/${projectId}/steps/${stepId}/run`, request, handlers);

/** Trả lời `answer_needed`; luồng SSE của `/run` tiếp tục. */
export const answerStep = (projectId: string, stepId: string, request: StepAnswerRequest) =>
  apiCall<{ accepted: boolean }>(`/projects/${projectId}/steps/${stepId}/answer`, {
    method: "POST",
    body: JSON.stringify(request),
  });

export const submitGate = (projectId: string, stepId: string, request: GateRequest) =>
  apiCall<GateResponse>(`/projects/${projectId}/steps/${stepId}/gate`, {
    method: "POST",
    body: JSON.stringify(request),
  });

/**
 * Trạng thái lượt chạy của một step (FLF-202 / BUG-07): reload hay mất mạng xong gọi hàm này để dựng lại
 * đúng chỗ — đang hỏi thì dựng lại form, đang ở gate thì dựng lại thẻ duyệt — mà không chạy lại step.
 */
export const getRunState = (projectId: string, stepId: string) =>
  apiCall<RunState | null>(`/projects/${projectId}/steps/${stepId}/run-state`);

/** Lượt chạy còn sống của dự án — khôi phục pill "đang chạy nền" khi mở lại trang. */
export const getActiveRunState = (projectId: string) => apiCall<RunState | null>(`/projects/${projectId}/run-state/active`);

/** Huỷ lượt đang chạy: nhả khoá step và huỷ luôn request đang mở tới model (BUG-05). */
export const cancelRun = (projectId: string, stepId: string, runId?: string) =>
  apiCall<{ cancelled: boolean; run_id: string | null }>(`/projects/${projectId}/steps/${stepId}/cancel`, {
    method: "POST",
    body: JSON.stringify(runId ? { run_id: runId } : {})
  });

/** Mở lại project: BE revert step `in_progress` dang dở (đóng tab giữa Draft) rồi trả tiến độ. */
export const resumeProject = (projectId: string) =>
  apiCall<ResumeResponse>(`/projects/${projectId}/resume`, { method: "POST" });
