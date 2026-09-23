"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiClientError } from "@/lib/api/client";
import { answerStep, cancelRun, getActiveRunState, getRunState, runPhase, runStep, submitGate } from "@/lib/api/pipeline";
import type {
  ChangeSummary,
  GateAction,
  GateReadyEvent,
  GateResponse,
  Question,
  RunStage,
  RunState,
  StepAnswer,
  StepEvent,
} from "@/types/pipeline";

export type RunnerStatus =
  | "idle"
  | "intake"
  | "eliciting"
  | "needs_input"
  | "drafting"
  | "applied"
  | "rendering"
  | "gate_ready"
  | "reconnecting"
  | "interrupted"
  | "error";

export interface RunnerGate {
  actions: GateAction[];
  regenerate_used: number;
  calls_used: number;
  /** Lớp 4 "Bạn vừa có" — nội dung của gate, không chỉ con số (WP-5). */
  payload: GateReadyEvent | null;
}

export interface RunnerState {
  status: RunnerStatus;
  stepId: string | null;
  events: StepEvent[];
  elicitText: string;
  questions: Question[];
  gate: RunnerGate | null;
  error: { code: string; message: string; meta?: Record<string, unknown> } | null;
  busy: boolean;
  // ─── tiến trình trực tiếp (03-live-status-flow Lớp 3) ───
  stage: RunStage | null;
  /** Câu mô tả việc đang làm ("AI đang soạn nội dung · lô 1/2"). */
  detail: string | null;
  batch: { i: number; n: number } | null;
  /** Mốc bắt đầu lượt (ms) — component tự đếm đồng hồ, hook không tick mỗi giây. */
  startedAt: number | null;
  /** Lần cuối có tín hiệu thật từ BE — quá lâu ⇒ hiện "chậm hơn thường lệ" rồi "mất kết nối". */
  lastEventAt: number | null;
  /** Nội dung vừa ghi trong lượt này ("Vừa ghi": + FN010 validation …). */
  summary: ChangeSummary[];
  /** AI phải thử lại: nói bằng lời thường, không hiện mã lỗi. */
  retry: { attempt: number; max: number; reason: string } | null;
  // ─── chạy liền theo giai đoạn (02-reduce-stops R2) ───
  /** Giai đoạn đang chạy liền (`S-4`, `S-5@S03`); null ⇒ đang chạy một bước lẻ. */
  phase: string | null;
  /** Vị trí trong chuỗi: bước thứ mấy trên tổng. */
  phaseProgress: { index: number; total: number } | null;
  /** Bước đã tự Accept trong chuỗi này — hiện thành một dòng nhật ký, mở lại được. */
  autoAccepted: { step_id: string; reason_vi: string }[];
  /** Cổng chốt cuối giai đoạn: tóm tắt của cả giai đoạn. */
  phaseGate: Extract<StepEvent, { type: "phase_gate" }> | null;
}

export type RunnerAction =
  | { type: "start"; stepId: string }
  | { type: "startPhase"; phase: string }
  | { type: "event"; event: StepEvent; at?: number }
  | { type: "answered"; count?: number }
  | { type: "busy"; busy: boolean }
  | { type: "failed"; code: string; message: string; meta?: Record<string, unknown> }
  | { type: "restored"; state: RunState; at?: number }
  | { type: "reconnecting" }
  | { type: "interrupted" }
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
  stage: null,
  detail: null,
  batch: null,
  startedAt: null,
  lastEventAt: null,
  summary: [],
  retry: null,
  phase: null,
  phaseProgress: null,
  autoAccepted: [],
  phaseGate: null,
};

const STATUS_BY_STAGE: Record<RunStage, RunnerStatus> = {
  intake: "intake",
  ask: "eliciting",
  draft: "drafting",
  check: "applied",
  render: "rendering",
  gate: "gate_ready",
};

const STATUS_BY_EVENT: Partial<Record<StepEvent["type"], RunnerStatus>> = {
  intake: "intake",
  elicit: "eliciting",
  answer_needed: "needs_input",
  answer_received: "drafting",
  draft: "drafting",
  ops_applied: "applied",
  render: "rendering",
  flags: "applied",
  gate_ready: "gate_ready",
  error: "error",
};

const gateOf = (event: GateReadyEvent): RunnerGate => ({
  actions: event.actions,
  regenerate_used: event.regenerate_used,
  calls_used: event.calls_used,
  payload: event,
});

/** Máy trạng thái của một lượt chạy step — thuần để test (03-live-status-flow §4). */
export function stepRunnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "start": {
      const now = Date.now();
      return { ...initialRunnerState, status: "intake", stepId: action.stepId, busy: true, startedAt: now, lastEventAt: now, detail: "Đang khởi động…" };
    }
    case "startPhase": {
      const now = Date.now();
      return {
        ...initialRunnerState,
        status: "intake",
        phase: action.phase,
        busy: true,
        startedAt: now,
        lastEventAt: now,
        detail: "Đang khởi động giai đoạn…",
      };
    }
    case "event": {
      const { event } = action;
      const at = action.at ?? Date.now();
      // heartbeat chỉ để biết lượt còn sống — không vào nhật ký, không đổi trạng thái
      if (event.type === "heartbeat") return { ...state, lastEventAt: at, stage: event.stage };

      const next: RunnerState = {
        ...state,
        events: [...state.events, event],
        lastEventAt: at,
        status: STATUS_BY_EVENT[event.type] ?? state.status,
      };
      switch (event.type) {
        case "stage":
          return {
            ...next,
            stage: event.stage,
            status: STATUS_BY_STAGE[event.stage],
            detail: event.detail_vi ?? event.label_vi,
            batch: event.batch ?? null,
            retry: null,
          };
        case "elicit":
          return { ...next, elicitText: state.elicitText + event.delta };
        case "answer_needed":
          return { ...next, questions: event.questions, busy: false, detail: `Chờ bạn trả lời ${event.questions.length} câu hỏi` };
        case "answer_received":
          return { ...next, questions: [], busy: true, detail: `Đã nhận ${event.count} câu trả lời · đang soạn…` };
        case "draft_retry":
          return { ...next, status: "drafting", retry: { attempt: event.attempt, max: event.max, reason: event.reason_vi } };
        case "ops_applied":
          return { ...next, summary: [...state.summary, ...(event.summary ?? [])] };
        case "gate_ready":
          return { ...next, gate: gateOf(event), busy: false, stage: "gate", detail: null, retry: null };
        case "phase_progress":
          return {
            ...next,
            status: state.status,
            phase: event.phase,
            phaseProgress: { index: event.step_index, total: event.step_total },
            stepId: event.step_id,
            busy: !event.needs_user,
          };
        case "auto_accepted":
          // Bước tự hoàn tất: một dòng trong nhật ký, không phải một cổng chốt phải bấm
          return { ...next, status: state.status, autoAccepted: [...state.autoAccepted, { step_id: event.step_id, reason_vi: event.reason_vi }] };
        case "phase_gate":
          return { ...next, status: state.status, phaseGate: event };
        case "error":
          return { ...next, error: { code: event.code, message: event.message }, busy: false };
        default:
          return next;
      }
    }
    case "answered":
      // Phản hồi lạc quan: trạng thái đổi ngay khi bấm gửi, không chờ BE (BUG-32)
      return {
        ...state,
        questions: [],
        status: "drafting",
        busy: true,
        detail: action.count ? `Đã nhận ${action.count} câu trả lời · đang soạn…` : "Đã nhận câu trả lời · đang soạn…",
        lastEventAt: Date.now()
      };
    case "busy":
      return { ...state, busy: action.busy };
    case "failed":
      return { ...state, status: "error", error: { code: action.code, message: action.message, ...(action.meta ? { meta: action.meta } : {}) }, busy: false };
    case "reconnecting":
      return { ...state, status: "reconnecting", detail: "Mất kết nối với lượt chạy, đang kết nối lại…" };
    case "interrupted":
      return { ...state, status: "interrupted", busy: false, detail: "Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ." };
    case "restored": {
      const { state: run } = action;
      const at = action.at ?? Date.now();
      const events = run.events ?? [];
      const summary = events.flatMap((e) => (e.type === "ops_applied" ? (e.summary ?? []) : []));
      const base: RunnerState = {
        ...initialRunnerState,
        stepId: run.step_id,
        events,
        summary,
        stage: run.stage,
        detail: run.detail_vi,
        batch: run.batch,
        startedAt: new Date(run.started_at).getTime(),
        lastEventAt: at,
      };
      if (run.status === "gate" && run.gate_payload) return { ...base, status: "gate_ready", gate: gateOf(run.gate_payload) };
      if (run.status === "waiting_answer" && run.questions) return { ...base, status: "needs_input", questions: run.questions };
      if (run.status === "running" && run.alive) return { ...base, status: STATUS_BY_STAGE[run.stage], busy: true };
      if (run.status === "interrupted" || (run.status === "running" && !run.alive)) {
        return { ...base, status: "interrupted", detail: "Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ." };
      }
      return initialRunnerState;
    }
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

/** Không có tín hiệu nào trong ngần này ⇒ coi như mất kết nối, đi hỏi BE lượt còn sống không (03 §3). */
export const HEARTBEAT_TIMEOUT_MS = 30_000;
const WATCHDOG_TICK_MS = 5_000;

const toFailure = (err: unknown): { code: string; message: string; meta?: Record<string, unknown> } =>
  err instanceof ApiClientError
    ? { code: err.code, message: err.rawMessage || err.message, ...(err.meta ? { meta: err.meta } : {}) }
    : { code: "UNKNOWN_ERROR", message: err instanceof Error ? err.message : String(err) };

/**
 * Lần chạy trước của chính step này còn dở ở BE (reload trang giữa chừng): BE huỷ lượt gọi model đang bay rồi
 * nhả khoá, nhưng mất một nhịp. Chờ rồi thử lại thay vì ném "đang được xử lý ở một request khác" vào mặt người dùng.
 */
const isStepBusy = (err: unknown): boolean => err instanceof ApiClientError && err.code === "STEP_NOT_RUNNABLE" && /request khác/.test(err.message);
const BUSY_RETRIES = 3;
const BUSY_DELAY_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useStepRunner({ projectId, sessionId, getBaseVersion, onSpineChanged, onGateDone }: UseStepRunnerOptions) {
  const [state, dispatch] = useReducer(stepRunnerReducer, initialRunnerState);
  const stepRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Giai đoạn đang chạy liền: còn giá trị ⇒ Accept xong là chạy tiếp phần còn lại, không bắt bấm lại. */
  const phaseRef = useRef<string | null>(null);

  // Rời trang / đổi project: đóng luồng SSE đang mở
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (stepId: string, options: { reopen?: boolean } = {}) => {
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

      try {
        for (let attempt = 0; ; attempt++) {
          let terminated = false;
          try {
            await runStep(projectId, stepId, { session_id: sessionId, base_version: baseVersion, ...(options.reopen ? { reopen: true } : {}) }, {
              signal: controller.signal,
              onEvent: (event) => {
                // Luồng cũ đã bị huỷ, hoặc sự kiện của step khác: bỏ qua
                if (controller.signal.aborted || event.step_id !== stepId) return;
                if (isTerminalEvent(event)) terminated = true;
                dispatch({ type: "event", event, at: Date.now() });
                if (event.type === "ops_applied") onSpineChanged(event.spine_version);
                if (event.type === "gate_ready") onSpineChanged();
              },
            });
            if (!controller.signal.aborted && !terminated) {
              dispatch({ type: "failed", code: STREAM_CLOSED, message: "Kết nối tới step bị đóng giữa chừng. Vui lòng chạy lại." });
            }
            return;
          } catch (err) {
            if (controller.signal.aborted) return;
            if (isStepBusy(err) && attempt < BUSY_RETRIES) {
              await sleep(BUSY_DELAY_MS);
              if (controller.signal.aborted) return;
              dispatch({ type: "start", stepId });
              continue;
            }
            dispatch({ type: "failed", ...toFailure(err) });
            return;
          }
        }
      } finally {
        // Bước lỗi giữa chừng vẫn có thể đã ghi vài op ⇒ `spine_version` đã đổi. Không tải lại ở đây thì
        // nút "Thử lại" gửi `base_version` cũ và nhận 409 ngay, đúng vòng lặp user gặp ở lượt test.
        onSpineChanged();
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [projectId, sessionId, getBaseVersion, onSpineChanged]
  );

  /**
   * Chạy liền cả giai đoạn (R2): một luồng, bước yên lặng tự Accept, dừng khi cần bạn. Giữ nguyên mọi
   * sự kiện của từng bước nên màn hình tiến trình không phải đổi gì.
   */
  const runWholePhase = useCallback(
    async (phase: string) => {
      const baseVersion = getBaseVersion();
      if (!sessionId || baseVersion === null) {
        dispatch({ type: "failed", code: "NOT_PIPELINE_SESSION", message: "Chưa có phiên pipeline hoặc Spine chưa tải xong" });
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      phaseRef.current = phase;
      dispatch({ type: "startPhase", phase });

      // Chuỗi dừng ở một cổng chốt ⇒ giữ `phaseRef` để Accept xong chạy tiếp. Chuỗi chạy hết giai đoạn
      // mà không dừng ⇒ quên giai đoạn đi, nếu không Accept của bước lẻ sau đó lại khởi động chuỗi mới.
      let stoppedAtGate = false;
      let failed = false;
      try {
        await runPhase(projectId, phase, { session_id: sessionId, base_version: baseVersion }, {
          signal: controller.signal,
          onEvent: (event) => {
            if (controller.signal.aborted) return;
            if (event.type === "phase_progress" || event.type === "auto_accepted" || event.type === "phase_gate") stepRef.current = event.step_id;
            else if (event.step_id !== stepRef.current && event.type !== "error") stepRef.current = event.step_id;
            dispatch({ type: "event", event, at: Date.now() });
            if (event.type === "ops_applied") onSpineChanged(event.spine_version);
            if (event.type === "gate_ready" || event.type === "auto_accepted") onSpineChanged();
            if (event.type === "gate_ready" || event.type === "phase_gate") stoppedAtGate = true;
          },
        });
      } catch (err) {
        failed = true;
        if (!controller.signal.aborted) dispatch({ type: "failed", ...toFailure(err) });
      } finally {
        if (!stoppedAtGate) phaseRef.current = null;
        // Giai đoạn đã xong: luồng đóng mà không có cổng chốt nào. Không trả về "rảnh" ở đây thì màn hình
        // treo ở trạng thái đang chạy — không thẻ tiến trình, không thẻ "Bước này sẽ…", không nút nào.
        if (!stoppedAtGate && !failed && !controller.signal.aborted) dispatch({ type: "reset" });
        onSpineChanged();
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [projectId, sessionId, getBaseVersion, onSpineChanged]
  );

  const answer = useCallback(
    async (answers: StepAnswer[]) => {
      const stepId = stepRef.current;
      if (!stepId || !sessionId) return;
      dispatch({ type: "answered", count: answers.length });
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
        } else if (phaseRef.current) {
          // Đang chạy liền cả giai đoạn: duyệt xong là đi tiếp ngay. Không có nhánh này thì "Chạy cả giai
          // đoạn" chỉ tiết kiệm được tới câu hỏi đầu tiên, user lại phải bấm chạy cho từng bước còn lại.
          dispatch({ type: "reset" });
          await runWholePhase(phaseRef.current);
        } else {
          dispatch({ type: "reset" });
        }
      } catch (err) {
        // Tài liệu vừa đổi ở bước khác: tải lại Spine rồi để user bấm lại — không tự ghi đè (BUG-06)
        if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") onSpineChanged();
        dispatch({ type: "failed", ...toFailure(err) });
      }
    },
    [projectId, sessionId, getBaseVersion, onSpineChanged, onGateDone, run, runWholePhase]
  );

  /** Huỷ lượt đang chạy: BE nhả khoá và abort request tới model; FE đóng stream (BUG-05). */
  const cancel = useCallback(async () => {
    const stepId = stepRef.current ?? state.stepId;
    if (!stepId) return;
    dispatch({ type: "busy", busy: true });
    try {
      await cancelRun(projectId, stepId);
    } catch {
      // Huỷ thất bại thì khoá vẫn tự hết hạn — không chặn user
    }
    abortRef.current?.abort();
    phaseRef.current = null;
    dispatch({ type: "reset" });
  }, [projectId, state.stepId]);

  /**
   * Dựng lại màn hình sau reload/mất mạng (BUG-07): lượt còn sống thì nối lại đúng chỗ, lượt đã chết thì
   * nói rõ là gián đoạn. Không chạy lại step ⇒ không tốn credit.
   */
  const restore = useCallback(
    async (stepId?: string) => {
      try {
        const res = stepId ? await getRunState(projectId, stepId) : await getActiveRunState(projectId);
        const run = res.data;
        if (!run) return null;
        stepRef.current = run.step_id;
        dispatch({ type: "restored", state: run, at: Date.now() });
        return run;
      } catch {
        return null;
      }
    },
    [projectId]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    phaseRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  // ─── canh chừng: không có tín hiệu nào quá lâu ⇒ hỏi BE lượt còn sống không (03 §3) ───
  const waiting = state.busy && (state.status === "drafting" || state.status === "intake" || state.status === "eliciting" || state.status === "rendering");
  useEffect(() => {
    if (!waiting || !state.stepId) return;
    const timer = setInterval(() => {
      if (state.lastEventAt === null || Date.now() - state.lastEventAt < HEARTBEAT_TIMEOUT_MS) return;
      dispatch({ type: "reconnecting" });
      void getRunState(projectId, state.stepId as string)
        .then((res) => {
          const run = res.data;
          if (!run || !run.alive) dispatch({ type: "interrupted" });
          else dispatch({ type: "restored", state: run, at: Date.now() });
        })
        .catch(() => dispatch({ type: "interrupted" }));
    }, WATCHDOG_TICK_MS);
    return () => clearInterval(timer);
  }, [waiting, state.stepId, state.lastEventAt, projectId]);

  return { state, run, runWholePhase, answer, gate, cancel, restore, reset };
}
