"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiClientError } from "@/lib/api/client";
import { answerStep, runStep, submitGate } from "@/lib/api/pipeline";
import type { GateAction, GateResponse, Question, StepAnswer, StepEvent } from "@/types/pipeline";

export type RunnerStatus =
  | "idle"
  | "intake"
  | "eliciting"
  | "needs_input"
  | "drafting"
  | "applied"
  | "rendering"
  | "gate_ready"
  | "error";

export interface RunnerGate {
  actions: GateAction[];
  regenerate_used: number;
  calls_used: number;
}

export interface RunnerState {
  status: RunnerStatus;
  stepId: string | null;
  events: StepEvent[];
  elicitText: string;
  questions: Question[];
  gate: RunnerGate | null;
  error: { code: string; message: string } | null;
  busy: boolean;
}

export type RunnerAction =
  | { type: "start"; stepId: string }
  | { type: "event"; event: StepEvent }
  | { type: "answered" }
  | { type: "busy"; busy: boolean }
  | { type: "failed"; code: string; message: string }
  | { type: "reset" };

export const initialRunnerState: RunnerState = {
  status: "idle",
  stepId: null,
  events: [],
  elicitText: "",
  questions: [],
  gate: null,
  error: null,
  busy: false,
};

const STATUS_BY_EVENT: Record<StepEvent["type"], RunnerStatus> = {
  intake: "intake",
  elicit: "eliciting",
  answer_needed: "needs_input",
  draft: "drafting",
  ops_applied: "applied",
  render: "rendering",
  flags: "applied",
  gate_ready: "gate_ready",
  error: "error",
};

/** Máy trạng thái của một lượt chạy step — thuần để test. */
export function stepRunnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "start":
      return { ...initialRunnerState, status: "intake", stepId: action.stepId, busy: true };
    case "event": {
      const { event } = action;
      const next: RunnerState = { ...state, events: [...state.events, event], status: STATUS_BY_EVENT[event.type] };
      switch (event.type) {
        case "elicit":
          return { ...next, elicitText: state.elicitText + event.delta };
        case "answer_needed":
          return { ...next, questions: event.questions, busy: false };
        case "gate_ready":
          return {
            ...next,
            gate: { actions: event.actions, regenerate_used: event.regenerate_used, calls_used: event.calls_used },
            busy: false,
          };
        case "error":
          return { ...next, error: { code: event.code, message: event.message }, busy: false };
        default:
          return next;
      }
    }
    case "answered":
      return { ...state, questions: [], status: "drafting", busy: true };
    case "busy":
      return { ...state, busy: action.busy };
    case "failed":
      return { ...state, status: "error", error: { code: action.code, message: action.message }, busy: false };
    case "reset":
      return initialRunnerState;
  }
}

export interface UseStepRunnerOptions {
  projectId: string;
  sessionId: string | null;
  /** `spine_version` hiện tại; đọc lúc gọi nên luôn là giá trị mới nhất. */
  getBaseVersion: () => number | null;
  /**
   * Transaction của step đã ghi (ops_applied) hoặc gate xong — tải lại Spine/tiến độ.
   * `spineVersion` có khi BE báo version mới, để lượt ghi kế tiếp không gửi `base_version` cũ.
   */
  onSpineChanged: (spineVersion?: number) => void;
  onGateDone?: (response: GateResponse) => void;
}

/** Luồng SSE của `/run` chỉ được đóng sau hai sự kiện này (contract §2). */
export const isTerminalEvent = (event: StepEvent): boolean => event.type === "gate_ready" || event.type === "error";

export const STREAM_CLOSED = "STREAM_CLOSED";

const toFailure = (err: unknown): { code: string; message: string } =>
  err instanceof ApiClientError
    ? { code: err.code, message: err.message }
    : { code: "UNKNOWN_ERROR", message: err instanceof Error ? err.message : String(err) };

export function useStepRunner({ projectId, sessionId, getBaseVersion, onSpineChanged, onGateDone }: UseStepRunnerOptions) {
  const [state, dispatch] = useReducer(stepRunnerReducer, initialRunnerState);
  const stepRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Rời trang / đổi project: đóng luồng SSE đang mở
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (stepId: string) => {
      const baseVersion = getBaseVersion();
      if (!sessionId || baseVersion === null) {
        dispatch({ type: "failed", code: "NOT_PIPELINE_SESSION", message: "Chưa có phiên pipeline hoặc Spine chưa tải xong" });
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stepRef.current = stepId;
      dispatch({ type: "start", stepId });

      let terminated = false;
      try {
        await runStep(projectId, stepId, { session_id: sessionId, base_version: baseVersion }, {
          signal: controller.signal,
          onEvent: (event) => {
            // Luồng cũ đã bị huỷ, hoặc sự kiện của step khác: bỏ qua
            if (controller.signal.aborted || event.step_id !== stepId) return;
            if (isTerminalEvent(event)) terminated = true;
            dispatch({ type: "event", event });
            if (event.type === "ops_applied") onSpineChanged(event.spine_version);
            if (event.type === "gate_ready") onSpineChanged();
          },
        });
        if (!controller.signal.aborted && !terminated) {
          dispatch({ type: "failed", code: STREAM_CLOSED, message: "Kết nối tới step bị đóng giữa chừng. Vui lòng chạy lại." });
        }
      } catch (err) {
        if (!controller.signal.aborted) dispatch({ type: "failed", ...toFailure(err) });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [projectId, sessionId, getBaseVersion, onSpineChanged]
  );

  const answer = useCallback(
    async (answers: StepAnswer[]) => {
      const stepId = stepRef.current;
      if (!stepId || !sessionId) return;
      dispatch({ type: "answered" });
      try {
        await answerStep(projectId, stepId, { session_id: sessionId, answers });
      } catch (err) {
        dispatch({ type: "failed", ...toFailure(err) });
      }
    },
    [projectId, sessionId]
  );

  const gate = useCallback(
    async (action: GateAction, note?: string) => {
      const stepId = stepRef.current;
      const baseVersion = getBaseVersion();
      if (!stepId || !sessionId || baseVersion === null) return;
      dispatch({ type: "busy", busy: true });
      try {
        const res = await submitGate(projectId, stepId, {
          session_id: sessionId,
          action,
          base_version: baseVersion,
          ...(note ? { note } : {}),
        });
        onSpineChanged(res.data?.spine_version);
        if (res.data) onGateDone?.(res.data);
        if (action === "regenerate" || action === "revision") {
          await run(stepId);
        } else {
          dispatch({ type: "reset" });
        }
      } catch (err) {
        dispatch({ type: "failed", ...toFailure(err) });
      }
    },
    [projectId, sessionId, getBaseVersion, onSpineChanged, onGateDone, run]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, run, answer, gate, reset };
}
