/**
 * Step pipeline — theo danh sách endpoint T08; chốt payload theo `pipeline-contract.md` ở T12.
 */
import type {
  GateRequest,
  ProgressResponse,
  StepAnswers,
  StepEvent,
  StepSummary,
} from "@/types/pipeline";
import { streamSse, type SseHandlers } from "../ai-stream";
import { apiCall } from "./client";

export const getProgress = (projectId: string) =>
  apiCall<ProgressResponse>(`/projects/${projectId}/progress`);

export const listSteps = (projectId: string) =>
  apiCall<StepSummary[]>(`/projects/${projectId}/steps`);

/** Chạy một step; BE trả luồng SSE các `StepEvent`. */
export const runStep = (
  projectId: string,
  stepId: string,
  handlers: SseHandlers<StepEvent>,
  body: Record<string, unknown> = {}
) => streamSse<StepEvent>(`/projects/${projectId}/steps/${stepId}/run`, body, handlers);

export const answerStep = (projectId: string, stepId: string, answers: StepAnswers) =>
  apiCall<unknown>(`/projects/${projectId}/steps/${stepId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

export const submitGate = (projectId: string, stepId: string, request: GateRequest) =>
  apiCall<unknown>(`/projects/${projectId}/steps/${stepId}/gate`, {
    method: "POST",
    body: JSON.stringify(request),
  });
