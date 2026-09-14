/**
 * msw handlers theo `docs/api/pipeline-contract.md` (T08). Bật bằng `NEXT_PUBLIC_API_MOCK=1`.
 * Kịch bản: step có câu hỏi ⇒ `answer_needed` rồi đợi `POST /answer`; Draft áp một lô op giả;
 * `gate_ready`; Gate thi hành trần Regenerate 3 lần và `accept_as_is` bắt buộc note.
 */
import { delay, http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api/client";
import {
  CALLS_LIMIT,
  REGENERATE_LIMIT,
  STEP_REGISTRY,
  getStepDef,
  orderedSteps,
  phaseOfStep,
} from "@/lib/constants/step-registry";
import type { ChatMessage } from "@/types/chat";
import type {
  ApplyResult,
  ChangeDiff,
  ChangeRequest,
  GateAction,
  GateRequest,
  GateResponse,
  Op,
  ProgressResponse,
  Question,
  RunStepRequest,
  StepAnswerRequest,
  StepEvent,
  StepSummary,
  StepsResponse,
} from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import {
  countersOf,
  mockState,
  nextMockStep,
  setStepStatus,
  stepStatusOf,
  type MockState,
} from "./state";

const api = (path: string) => `${API_BASE_URL}${path}`;

const ok = <T>(data: T, init?: ResponseInit) => HttpResponse.json({ data, error: null }, init);

const fail = (status: number, code: string, message: string, meta?: Record<string, unknown>) =>
  HttpResponse.json({ data: null, error: { code, message }, ...(meta ? { meta } : {}) }, { status });

const conflict = (state: MockState) =>
  fail(409, "SPINE_VERSION_CONFLICT", "Tài liệu vừa được thay đổi ở phiên khác. Vui lòng tải lại rồi thử lại.", {
    spine_version: state.spine.spine_version,
  });

// ─── spine helpers ───────────────────────────────────────────────

type Collection = "actors" | "entities" | "screens" | "glossary" | "use_cases" | "features" | "roles";

const PATH_RE = /^([a-z_]+)\[id=([^\]]+)\]\.([a-z_]+)$/;

/** Áp op đơn giản cho mock: `project.<field>`, `<collection>[id=X].<field>`, `<collection>[]`. */
const applyMockOp = (spine: Spine, op: Op): ChangeDiff => {
  const reason = op.reason ?? null;
  if (op.path.startsWith("project.") && op.op === "set") {
    const key = op.path.slice("project.".length) as keyof Spine["project"];
    const before = spine.project[key];
    (spine.project as unknown as Record<string, unknown>)[key] = op.value;
    return { op: op.op, path: op.path, before, value: op.value, reason };
  }
  const match = PATH_RE.exec(op.path);
  if (match && op.op === "set") {
    const [, collection, id, field] = match;
    const list = spine[collection as Collection] as unknown as Record<string, unknown>[] | undefined;
    const element = list?.find((el) => el.id === id);
    if (!element) throw new Error(`path_not_resolved: ${op.path}`);
    if (field === "id") throw new Error(`key_change_forbidden: ${op.path}`);
    const before = element[field];
    element[field] = op.value;
    return { op: op.op, path: op.path, before, value: op.value, reason };
  }
  if (op.op === "add" && op.path.endsWith("[]")) {
    const collection = op.path.slice(0, -2) as Collection;
    const list = spine[collection] as unknown as unknown[] | undefined;
    if (!list) throw new Error(`path_not_resolved: ${op.path}`);
    list.push(op.value);
    const id = (op.value as { id?: string }).id;
    return { op: op.op, path: id ? `${collection}[id=${id}]` : op.path, before: { _absent: true }, value: op.value, reason };
  }
  throw new Error(`op_not_allowed: ${op.op} ${op.path}`);
};

const commit = (state: MockState, diffs: ChangeDiff[], stepId: string | null): Change[] => {
  state.spine.spine_version += 1;
  const txn = `mock-${state.spine.spine_version}`;
  return diffs.map((d, i) => ({
    projectId: state.spine.projectId,
    seq: state.spine.spine_version * 100 + i,
    txn,
    op: d.op,
    path: d.path,
    before: d.before,
    value: d.value,
    reason: d.reason,
    at: new Date().toISOString(),
    by: state.user.id,
    step_id: stepId,
  }));
};

/** Lô op giả mà "model" phát cho từng step của kịch bản S-3. */
export const mockDraftOps = (spine: Spine, stepId: string, attempt: number): Op[] => {
  const suffix = attempt > 1 ? ` (v${attempt})` : "";
  switch (stepId) {
    case "S-3.1":
      return spine.actors.some((a) => a.id === "A01")
        ? [{ op: "set", path: "actors[id=A01].description", value: `Owns the project and drives every step${suffix}.`, reason: "Regenerate" }]
        : [
            { op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Owns the project and drives every step." }, reason: "Actor từ Brief" },
            { op: "add", path: "actors[]", value: { id: "A02", name: "Payment Gateway", kind: "system", description: "Processes subscription payments." }, reason: "Hệ thống ngoài" },
          ];
    case "S-3.2":
      return spine.use_cases.some((u) => u.id === "UC01")
        ? [{ op: "set", path: "use_cases[id=UC01].name", value: `Create Project${suffix}`, reason: "Regenerate" }]
        : [{ op: "add", path: "use_cases[]", value: { id: "UC01", name: "Create Project", actor_ids: ["A01"], function_ids: [], description: "", includes: [], extends: [] }, reason: "Mục tiêu của Founder" }];
    case "S-3.3":
      return spine.use_cases.some((u) => u.id === "UC02")
        ? []
        : [{ op: "add", path: "use_cases[]", value: { id: "UC02", name: "Reset Password", actor_ids: ["A01"], function_ids: [], description: "", includes: [], extends: [] }, reason: "Use case còn thiếu" }];
    case "S-3.5":
      return spine.use_cases.map((u) => ({ op: "set" as const, path: `use_cases[id=${u.id}].description`, value: `${u.name} for the founder${suffix}.`, reason: "Mô tả use case" }));
    default:
      return [];
  }
};

const QUESTIONS: Question[] = [
  { id: "q1", text: "Ai là người dùng chính của sản phẩm?", options: ["Founder", "Business Analyst", "Sinh viên"], multiple: true },
  { id: "q2", text: "Có hệ thống bên ngoài nào cần tích hợp không?", options: ["Cổng thanh toán", "Email", "Không có"] },
];

const gateActions = (regenerateUsed: number): GateAction[] =>
  regenerateUsed >= REGENERATE_LIMIT ? ["accept", "revision", "accept_as_is"] : ["accept", "revision", "regenerate"];

const summaryOf = (state: MockState, stepId: string): StepSummary => {
  const def = getStepDef(stepId);
  const counters = countersOf(state, stepId);
  return {
    id: stepId,
    phase: def?.phase ?? "",
    label_vi: def?.label_vi ?? stepId,
    label_en: def?.label_en ?? stepId,
    kind: def?.kind ?? "fixed",
    status: stepStatusOf(state, stepId),
    deterministic: def?.deterministic ?? false,
    calls_used: counters.calls_used,
    calls_limit: CALLS_LIMIT,
    regenerate_used: counters.regenerate_used,
    regenerate_limit: REGENERATE_LIMIT,
    accepted_at: state.spine.steps.find((s) => s.id === stepId)?.accepted_at ?? null,
  };
};

const progressOf = (state: MockState): ProgressResponse => {
  const steps = orderedSteps(state.spine);
  const done = steps.filter((s) => stepStatusOf(state, s.id) === "accepted").length;
  return {
    readiness: {
      accepted_pct: Math.round((done * 100) / steps.length),
      awaiting_reaccept: 0,
      red_open: state.spine.flags.filter((f) => f.level === "red" && !f.resolved_at && !f.waived_by_user).length,
      stale: 0,
    },
    progress: {
      done,
      total: steps.length,
      current_phase: state.spine.progress.current_phase,
      current_step: state.spine.progress.current_step,
      show_percent: stepStatusOf(state, "S-4.1") === "accepted",
    },
    sections: [],
  };
};

// ─── SSE ─────────────────────────────────────────────────────────

/** Kịch bản ném lỗi thì vẫn phát `error` rồi đóng luồng — không để client treo (contract §2). */
const sseStream = (stepId: string, produce: (send: (event: StepEvent) => void) => Promise<void>) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StepEvent) =>
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      try {
        await produce(send);
      } catch (err) {
        send({ type: "error", step_id: stepId, code: "STEP_NOT_RUNNABLE", message: `(mock) ${err instanceof Error ? err.message : String(err)}`, retryable: true });
      } finally {
        controller.close();
      }
    },
  });
  return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
};

/** Nhịp giả lập stream; 0 trong test. */
export const mockTiming = { stepDelayMs: 250 };

const runSteps = async (state: MockState, stepId: string, send: (event: StepEvent) => void) => {
  const def = getStepDef(stepId);
  const counters = countersOf(state, stepId);
  const pause = () => delay(mockTiming.stepDelayMs);

  setStepStatus(state, stepId, "in_progress");
  state.spine.progress.current_step = stepId;
  state.spine.progress.current_phase = phaseOfStep(stepId) ?? state.spine.progress.current_phase;
  send({ type: "intake", step_id: stepId, phase: def?.phase ?? "", empty_fields: [] });
  await pause();

  const needsQuestions = !counters.answered && def?.renders.length === 0 && !def.deterministic && counters.regenerate_used === 0;
  if (needsQuestions) {
    counters.calls_used += 1;
    send({ type: "elicit", step_id: stepId, delta: "Mình cần làm rõ vài điểm trước khi soạn." });
    const answered = new Promise<void>((resolve) => state.waiting.set(stepId, () => resolve()));
    send({ type: "answer_needed", step_id: stepId, questions: QUESTIONS });
    await answered;
    counters.answered = true;
  }

  if (def && !def.deterministic && def.renders.length === 0) {
    counters.calls_used += 1;
    const attempt = counters.regenerate_used + 1;
    send({ type: "draft", step_id: stepId, attempt });
    await pause();
    const ops = mockDraftOps(state.spine, stepId, attempt);
    if (ops.length > 0) {
      const diffs = ops.map((op) => applyMockOp(state.spine, op));
      commit(state, diffs, stepId);
      send({ type: "ops_applied", step_id: stepId, txn: `mock-${state.spine.spine_version}`, spine_version: state.spine.spine_version, changes: diffs });
    }
  }

  for (const kind of def?.renders ?? []) {
    await pause();
    send({ type: "render", step_id: stepId, diagram_id: `D-${kind}`, render_status: "ok" });
  }

  send({ type: "flags", step_id: stepId, red_open: 0, yellow_open: 0 });
  send({ type: "gate_ready", step_id: stepId, actions: gateActions(counters.regenerate_used), regenerate_used: counters.regenerate_used, calls_used: counters.calls_used });
};

// ─── handlers ────────────────────────────────────────────────────

export const handlers = [
  http.get(api("/users/me"), () => ok(mockState.user)),
  http.post(api("/ai-actions/estimate-cost"), async ({ request }) => {
    const body = (await request.json()) as { actionType?: string };
    return ok({ actionType: body.actionType ?? "chat", cost: 1 });
  }),

  http.get(api("/projects/:projectId"), () => ok(mockState.project)),
  http.get(api("/projects/:projectId/documents"), () => ok([])),
  http.get(api("/verification/projects/:projectId"), () => ok({})),

  http.get(api("/projects/:projectId/chats"), () => ok(mockState.sessions)),
  http.post(api("/projects/:projectId/chats"), () => {
    const session = { _id: `${Date.now()}`, projectId: mockState.project._id, messages: [], isActive: true, createdAt: new Date().toISOString() };
    mockState.sessions = [session, ...mockState.sessions.map((s) => ({ ...s, isActive: false }))];
    return ok(session);
  }),
  http.get(api("/projects/:projectId/chats/:chatId"), ({ params }) => {
    const session = mockState.sessions.find((s) => s._id === params.chatId);
    return session ? ok(session) : fail(404, "NOT_FOUND", "Không tìm thấy cuộc trò chuyện");
  }),
  http.delete(api("/projects/:projectId/chats/:chatId"), ({ params }) => {
    mockState.sessions = mockState.sessions.filter((s) => s._id !== params.chatId);
    return ok(null);
  }),
  http.post(api("/projects/:projectId/chats/:chatId/messages/stream"), async ({ params, request }) => {
    const body = (await request.json()) as { content: string; step?: string };
    const session = mockState.sessions.find((s) => s._id === params.chatId);
    if (!session) return fail(404, "NOT_FOUND", "Không tìm thấy cuộc trò chuyện");
    const reply = `(mock) Đã ghi nhận: "${body.content}". Bạn có thể chạy step ${mockState.spine.progress.current_step} ở thanh tiến độ.`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const user: ChatMessage = { role: "user", content: body.content, step: body.step, createdAt: new Date().toISOString() };
        const ai: ChatMessage = { role: "ai", content: reply, step: body.step, createdAt: new Date().toISOString() };
        for (const word of reply.split(" ")) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: `${word} ` })}\n\n`));
          await delay(mockTiming.stepDelayMs / 10);
        }
        session.messages = [...session.messages, user, ai];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", session, cost: 1 })}\n\n`));
        controller.close();
      },
    });
    return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
  }),

  http.get(api("/projects/:projectId/spine"), () => ok(mockState.spine)),
  http.get(api("/projects/:projectId/progress"), () => ok(progressOf(mockState))),
  http.get(api("/projects/:projectId/flags"), () => ok(mockState.spine.flags)),

  http.get(api("/projects/:projectId/steps"), () => {
    const response: StepsResponse = {
      current_phase: mockState.spine.progress.current_phase,
      current_step: mockState.spine.progress.current_step,
      steps: orderedSteps(mockState.spine).map((s) => summaryOf(mockState, s.id)),
    };
    return ok(response);
  }),

  http.post(api("/projects/:projectId/steps/:stepId/run"), async ({ params, request }) => {
    const stepId = String(params.stepId);
    const body = (await request.json()) as RunStepRequest;
    if (!getStepDef(stepId)) return fail(404, "STEP_NOT_FOUND", `Không có step ${stepId}`);
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    if (stepStatusOf(mockState, stepId) === "accepted") return fail(409, "STEP_NOT_RUNNABLE", `Step ${stepId} đã accepted`);
    const counters = countersOf(mockState, stepId);
    if (counters.calls_used >= CALLS_LIMIT) return fail(409, "CALL_LIMIT", "Đã hết 8 lượt gọi model của step", { calls_used: counters.calls_used });
    return sseStream(stepId, (send) => runSteps(mockState, stepId, send));
  }),

  http.post(api("/projects/:projectId/steps/:stepId/answer"), async ({ params, request }) => {
    const stepId = String(params.stepId);
    const body = (await request.json()) as StepAnswerRequest;
    const resume = mockState.waiting.get(stepId);
    if (!resume) return fail(409, "STEP_NOT_RUNNABLE", `Step ${stepId} không chờ câu trả lời`);
    if (!Array.isArray(body.answers) || body.answers.length === 0) return fail(400, "VALIDATION_ERROR", "Cần ít nhất một câu trả lời");
    mockState.waiting.delete(stepId);
    resume(body.answers);
    return ok({ accepted: true });
  }),

  http.post(api("/projects/:projectId/steps/:stepId/gate"), async ({ params, request }) => {
    const stepId = String(params.stepId);
    const body = (await request.json()) as GateRequest;
    if (!getStepDef(stepId)) return fail(404, "STEP_NOT_FOUND", `Không có step ${stepId}`);
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    if ((body.action === "revision" || body.action === "accept_as_is") && !body.note?.trim()) {
      return fail(400, "VALIDATION_ERROR", "revision và accept_as_is bắt buộc ghi chú");
    }
    const counters = countersOf(mockState, stepId);

    switch (body.action) {
      case "accept":
        setStepStatus(mockState, stepId, "accepted");
        break;
      case "accept_as_is":
        if (counters.regenerate_used < REGENERATE_LIMIT) {
          return fail(409, "STEP_NOT_RUNNABLE", "Accept as-is chỉ mở khi đã hết lượt Regenerate");
        }
        setStepStatus(mockState, stepId, "accepted");
        mockState.spine.flags.push({
          id: `FL${String(mockState.spine.flags.length + 1).padStart(3, "0")}`,
          level: "yellow",
          rule_id: "accepted_as_is",
          section_id: "fixed:I",
          target_id: stepId,
          message: body.note ?? "",
          remediation_step: stepId,
          opened_at_version: mockState.spine.spine_version,
          resolved_at: null,
          waived_by_user: false,
          waive_reason: null,
          waived_at_version: null,
        });
        break;
      case "regenerate":
        if (counters.regenerate_used >= REGENERATE_LIMIT) {
          return fail(409, "REGENERATE_LIMIT", "Đã dùng hết 3 lần Regenerate", { regenerate_used: counters.regenerate_used });
        }
        counters.regenerate_used += 1;
        setStepStatus(mockState, stepId, "revision_requested");
        break;
      case "revision":
        setStepStatus(mockState, stepId, "revision_requested");
        break;
    }

    const next = nextMockStep(mockState);
    if (body.action === "accept" || body.action === "accept_as_is") {
      mockState.spine.progress.current_step = next;
      mockState.spine.progress.current_phase = next ? (phaseOfStep(next) ?? null) : null;
    }
    const response: GateResponse = { step: summaryOf(mockState, stepId), next_step: next, spine_version: mockState.spine.spine_version };
    return ok(response);
  }),

  http.post(api("/projects/:projectId/changes"), async ({ request }) => {
    const body = (await request.json()) as ChangeRequest;
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    if (!body.ops?.length) return fail(501, "NOT_IMPLEMENTED", "Mock chỉ hỗ trợ ops thuần");
    try {
      const draft = structuredClone(mockState.spine);
      const diffs = body.ops.map((op) => applyMockOp(draft, op));
      mockState.spine = draft;
      const changes = commit(mockState, diffs, null);
      const result: ApplyResult = { txn: changes[0]?.txn ?? "mock", spine_version: mockState.spine.spine_version, changes, spine: mockState.spine };
      return ok(result);
    } catch (err) {
      const [rule, path] = String(err instanceof Error ? err.message : err).split(": ");
      return fail(422, "OP_INVALID", `Op không hợp lệ: ${path ?? rule}`, { violations: [{ rule, message: String(err), path }], referrers: [] });
    }
  }),
];

/** Số step registry mock đang phục vụ — dùng trong test. */
export const MOCK_STEP_COUNT = STEP_REGISTRY.length;
