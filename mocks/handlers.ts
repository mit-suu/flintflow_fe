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
import type { ChatMessage, ChatSession } from "@/types/chat";
import type {
  ApplyResult,
  ChangeDiff,
  ChangeRequest,
  GateAction,
  GateRequest,
  GateResponse,
  Op,
  PreviewResult,
  ProgressResponse,
  Question,
  RunStepRequest,
  SectionProgress,
  StepAnswerRequest,
  StepEvent,
  StepSummary,
  StepsResponse,
} from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import type { RenderedDocument } from "@/types/document";
import { FLAG_NOT_WAIVABLE_RULES } from "@/types/flags";
import type { TraceabilityEntity, TraceabilityResponse } from "@/types/flags";
import {
  countersOf,
  MOCK_SESSION_ID,
  mockState,
  nextMockStep,
  setStepStatus,
  stepStatusOf,
  type MockState,
} from "./state";

const api = (path: string) => `${API_BASE_URL}${path}`;

/**
 * `is_pipeline` (bất biến 7, `pipeline-contract.md` §0.3) — `types/chat.ts` (T07, R với T16) chưa
 * khai báo field này (xem `ChatPane.tsx` `TODO(XREQ-local-2)`). Session gốc mock
 * (`MOCK_SESSION_ID`) là pipeline; mọi session tạo thêm qua `POST /chats` là phụ.
 */
const withPipelineFlag = (session: ChatSession): ChatSession & { is_pipeline: boolean } => ({
  ...session,
  is_pipeline: session._id === MOCK_SESSION_ID,
});

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

/**
 * `ProgressResponse.sections[]` — dùng bởi `view/page.tsx` (T16, UC 1.14) để ẩn nội dung section
 * bắt buộc chưa `accepted`. Mirror đúng 3 section cố định `buildMockDocument` dựng (cùng tiêu chí
 * accepted/draft theo dữ liệu Spine) để mock nhất quán giữa `GET /document` và `GET /progress`.
 */
const mockSectionsProgress = (state: MockState): SectionProgress[] => [
  { id: "fixed:1", status: "accepted", awaiting_reaccept: false, required: true, derived: false },
  {
    id: "fixed:2.1",
    status: state.spine.actors.length ? "accepted" : "draft",
    awaiting_reaccept: false,
    required: true,
    derived: false,
  },
  {
    id: "fixed:2.2.2",
    status: state.spine.use_cases.length ? "accepted" : "draft",
    awaiting_reaccept: false,
    required: true,
    derived: false,
  },
];

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
    sections: mockSectionsProgress(state),
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

// ─── T16: changes/preview, reconcile, undo, traceability, document, export ────────
// Trạng thái phụ, độc lập với `MockState` (T12) — chỉ phục vụ các endpoint T16 thêm mới; không
// đụng `mocks/state.ts`. `resetMockChangeFlowState` dùng trong test riêng của T16, không nối vào
// `resetMockState` (thuộc T12).

const okWithMeta = <T>(data: T, meta: Record<string, unknown>) => HttpResponse.json({ data, meta, error: null });

/** `preview_id` → lô ops đã tính diff, chờ `POST /changes` hoặc `POST /reconcile` xác nhận. */
let mockPreviews = new Map<string, { base_version: number; ops: Op[] }>();
/** Lịch sử hiển thị ở `GET /changes` — chỉ ghi nhận thao tác qua Change panel (preview→apply/reconcile/undo). */
let mockChangesLog: Change[] = [];
let mockAssembledAtVersion: number | null = null;

export const resetMockChangeFlowState = (): void => {
  mockPreviews = new Map();
  mockChangesLog = [];
  mockAssembledAtVersion = null;
};

/** Lệnh tự nhiên (T17 chưa hiện thực) — mock đổi mô tả actor đầu tiên để có gì đó xem trước. */
const mockInstructionToOps = (spine: Spine, instruction: string): Op[] | null => {
  const first = spine.actors[0];
  if (!first) return null;
  return [
    {
      op: "set",
      path: `actors[id=${first.id}].description`,
      value: `${first.description} — ${instruction.trim()}`,
      reason: instruction.trim(),
    },
  ];
};

const previewOf = (state: MockState, baseVersion: number, ops: Op[]): PreviewResult => {
  const draft = structuredClone(state.spine);
  const changes = ops.map((op) => applyMockOp(draft, op));
  const previewId = `preview-${Date.now()}-${mockPreviews.size}`;
  mockPreviews.set(previewId, { base_version: baseVersion, ops });
  return { ok: true, txn: previewId, base_version: baseVersion, ops, changes, violations: [], referrers: [], branch: "silent", preview_id: previewId };
};

const isAbsentMarker = (value: unknown): value is { _absent: true } =>
  typeof value === "object" && value !== null && (value as Record<string, unknown>)._absent === true;

/**
 * Đảo một `Change` đã ghi: set lại `before`, hoặc — khi `before` là `{_absent:true}` (đánh dấu
 * "chưa tồn tại" do op `add` để lại) — xoá hẳn phần tử khỏi collection thay vì gán marker vào field.
 */
const revertMockChange = (spine: Spine, change: Change): ChangeDiff => {
  if (isAbsentMarker(change.before)) {
    const match = /^([a-z_]+)\[id=([^\]]+)\]$/.exec(change.path);
    if (!match) throw new Error(`path_not_resolved: ${change.path}`);
    const [, collection, id] = match;
    const list = spine[collection as Collection] as unknown as Record<string, unknown>[] | undefined;
    if (!list) throw new Error(`path_not_resolved: ${change.path}`);
    const index = list.findIndex((el) => el.id === id);
    const removed = index >= 0 ? list.splice(index, 1)[0] : undefined;
    return { op: "remove", path: change.path, before: removed ?? change.value, value: { _absent: true }, reason: `Undo #${change.seq}` };
  }
  return applyMockOp(spine, { op: "set", path: change.path, value: change.before, reason: `Undo #${change.seq}` });
};

/** Áp một `preview_id` đã tính sẵn — dùng chung cho `/changes` (instruction) và `/reconcile`. */
const applyMockPreview = (state: MockState, previewId: string, stepId: string | null = null): ApplyResult | null => {
  const stored = mockPreviews.get(previewId);
  if (!stored) return null;
  mockPreviews.delete(previewId);
  const draft = structuredClone(state.spine);
  const diffs = stored.ops.map((op) => applyMockOp(draft, op));
  state.spine = draft;
  const changes = commit(state, diffs, stepId);
  mockChangesLog = [...mockChangesLog, ...changes];
  return { txn: changes[0]?.txn ?? "mock", spine_version: state.spine.spine_version, changes, spine: state.spine };
};

/** Tài liệu ghép giả (T15 mock) — vài chương ngắn dựng từ Spine, đủ để DocumentPane/ExportPanel chạy trên mock. */
const buildMockDocument = (state: MockState): RenderedDocument => {
  const sections: RenderedDocument["sections"] = [
    {
      id: "fixed:1",
      number: "1",
      heading: "Product Overview",
      level: 1,
      status: "accepted",
      blocks: [{ type: "paragraph", runs: [{ text: state.spine.project.vision ?? "" }] }],
    },
    {
      id: "fixed:2.1",
      number: "2.1",
      heading: "Actors",
      level: 2,
      status: state.spine.actors.length ? "accepted" : "draft",
      blocks: state.spine.actors.length
        ? [
            {
              type: "table",
              header: [[{ text: "ID" }], [{ text: "Actor" }], [{ text: "Kind" }]],
              rows: state.spine.actors.map((a) => [[{ text: a.id }], [{ text: a.name, bold: true }], [{ text: a.kind }]]),
            },
          ]
        : [],
    },
    {
      id: "fixed:2.2.2",
      number: "2.2.2",
      heading: "Use Case Descriptions",
      level: 2,
      status: state.spine.use_cases.length ? "accepted" : "draft",
      blocks: state.spine.use_cases.length
        ? [{ type: "bullet_list", items: state.spine.use_cases.map((u) => [{ text: `${u.id}: ${u.name}` }]) }]
        : [],
    },
  ];

  // `FlagRow.section` là nhãn đã phân giải ("3.2.1 Create Project"), không phải `section_id` thô —
  // tra trong `sections` vừa dựng, rơi về chính `section_id` khi không khớp section nào ở trên.
  const sectionLabelOf = (sectionId: string): string => {
    const section = sections.find((s) => s.id === sectionId);
    return section ? `${section.number} ${section.heading}` : sectionId;
  };

  return {
    projectId: state.spine.projectId,
    projectName: state.project.name,
    version: `v0.${mockAssembledAtVersion ?? state.spine.spine_version}`,
    source: "draft",
    watermark: "DRAFT",
    generatedAt: new Date().toISOString(),
    sections,
    recordOfChanges: mockChangesLog.slice(-5).map((c) => ({
      date: c.at.slice(0, 10),
      version: `v${state.spine.spine_version}`,
      change_type: "M",
      in_charge: c.by,
      description: c.reason ?? c.path,
    })),
    flagsAppendix: {
      redOpen: state.spine.flags
        .filter((f) => f.level === "red" && !f.resolved_at && !f.waived_by_user)
        .map((f) => ({ id: f.id, rule_id: f.rule_id, section: sectionLabelOf(f.section_id), message: f.message })),
      staleCount: 0,
      waived: state.spine.flags
        .filter((f) => f.waived_by_user)
        .map((f) => ({ id: f.id, rule_id: f.rule_id, section: sectionLabelOf(f.section_id), message: f.message, waive_reason: f.waive_reason })),
    },
  };
};

const buildMockTraceability = (state: MockState, entity: TraceabilityEntity, id: string): TraceabilityResponse => {
  if (entity === "actor") {
    const actor = state.spine.actors.find((a) => a.id === id);
    if (!actor) return { nodes: [], edges: [] };
    const useCases = state.spine.use_cases.filter((u) => u.actor_ids.includes(id));
    return {
      nodes: [{ kind: "actor", id: actor.id, label: actor.name }, ...useCases.map((u) => ({ kind: "use_case" as const, id: u.id, label: u.name }))],
      edges: useCases.map((u) => ({ from: actor.id, to: u.id, field: "actor_ids" })),
    };
  }
  if (entity === "use_case") {
    const useCase = state.spine.use_cases.find((u) => u.id === id);
    if (!useCase) return { nodes: [], edges: [] };
    return {
      nodes: [
        { kind: "use_case", id: useCase.id, label: useCase.name },
        ...useCase.actor_ids
          .map((actorId) => state.spine.actors.find((a) => a.id === actorId))
          .filter((a): a is Spine["actors"][number] => Boolean(a))
          .map((a) => ({ kind: "actor" as const, id: a.id, label: a.name })),
      ],
      edges: useCase.actor_ids.map((actorId) => ({ from: useCase.id, to: actorId, field: "actor_ids" })),
    };
  }
  return { nodes: [], edges: [] };
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

  http.get(api("/projects/:projectId/chats"), () => ok(mockState.sessions.map(withPipelineFlag))),
  http.post(api("/projects/:projectId/chats"), () => {
    const session = { _id: `${Date.now()}`, projectId: mockState.project._id, messages: [], isActive: true, createdAt: new Date().toISOString() };
    mockState.sessions = [session, ...mockState.sessions.map((s) => ({ ...s, isActive: false }))];
    return ok(withPipelineFlag(session));
  }),
  http.get(api("/projects/:projectId/chats/:chatId"), ({ params }) => {
    const session = mockState.sessions.find((s) => s._id === params.chatId);
    return session ? ok(withPipelineFlag(session)) : fail(404, "NOT_FOUND", "Không tìm thấy cuộc trò chuyện");
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
    // T16: instruction đã xem trước (`preview_id` từ /changes/preview) — áp lô đã tính sẵn.
    // Bổ sung tối thiểu vào nhánh else (không sửa nhánh ops thuần bên dưới): msw khớp handler
    // theo thứ tự khai báo nên endpoint mới không thể "chen" trước handler này.
    if (!body.ops?.length && body.instruction && body.preview_id) {
      const result = applyMockPreview(mockState, body.preview_id, null);
      if (!result) return fail(422, "CHANGE_RANGE_INVALID", "preview_id không còn hiệu lực — xem trước lại");
      return ok(result);
    }
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

  // ─── T16: preview / reconcile / undo / traceability / flags waive+recompute / document / export ───

  http.post(api("/projects/:projectId/changes/preview"), async ({ request }) => {
    const body = (await request.json()) as ChangeRequest;
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    if (body.ops?.length) return ok(previewOf(mockState, body.base_version, body.ops));
    if (body.instruction) {
      const ops = mockInstructionToOps(mockState.spine, body.instruction);
      if (!ops) {
        const result: PreviewResult = {
          ok: false,
          txn: `preview-${Date.now()}`,
          base_version: body.base_version,
          ops: [],
          changes: [],
          violations: [],
          referrers: [],
          clarification: "Chưa rõ đối tượng cần sửa — hãy nêu tên actor/use case cụ thể (mock T16, T17 sẽ hiểu ngôn ngữ tự nhiên thật).",
        };
        return ok(result);
      }
      return ok(previewOf(mockState, body.base_version, ops));
    }
    return fail(400, "VALIDATION_ERROR", "Cần ops hoặc instruction");
  }),

  http.post(api("/projects/:projectId/reconcile"), async ({ request }) => {
    const body = (await request.json()) as { base_version: number; preview_id?: string };
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    if (body.preview_id) {
      const result = applyMockPreview(mockState, body.preview_id, null);
      if (!result) return fail(422, "CHANGE_RANGE_INVALID", "preview_id không còn hiệu lực — hoà giải lại");
      return ok(result);
    }
    // Mock không có thay đổi treo thật sự để gộp — trả preview rỗng để ChangePanel có preview_id xác nhận.
    return ok(previewOf(mockState, body.base_version, []));
  }),

  http.post(api("/projects/:projectId/undo"), async ({ request }) => {
    const body = (await request.json()) as { base_version: number };
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    const last = mockChangesLog[mockChangesLog.length - 1];
    if (!last) return fail(422, "NOTHING_TO_UNDO", "Không còn thao tác nào để undo");
    // Đảo cả dải change của lô (txn) cuối, theo seq giảm dần — không chỉ dòng cuối cùng.
    const txnChanges = mockChangesLog.filter((c) => c.txn === last.txn).sort((a, b) => b.seq - a.seq);
    const draft = structuredClone(mockState.spine);
    let revertDiffs: ChangeDiff[];
    try {
      revertDiffs = txnChanges.map((change) => ({ ...revertMockChange(draft, change), op: "revert" }));
    } catch (err) {
      const [rule, path] = String(err instanceof Error ? err.message : err).split(": ");
      return fail(422, "OP_INVALID", `Undo thất bại: ${path ?? rule}`, { violations: [{ rule, message: String(err), path }] });
    }
    mockChangesLog = mockChangesLog.filter((c) => c.txn !== last.txn);
    mockState.spine = draft;
    const changes = commit(mockState, revertDiffs, null);
    const result: ApplyResult = { txn: changes[0]?.txn ?? "mock", spine_version: mockState.spine.spine_version, changes, spine: mockState.spine };
    return ok(result);
  }),

  http.get(api("/projects/:projectId/changes"), () => ok(mockChangesLog.slice(-20))),

  http.get(api("/projects/:projectId/traceability"), ({ request }) => {
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity") as TraceabilityEntity | null;
    const id = url.searchParams.get("id");
    if (!entity || !id) return fail(400, "VALIDATION_ERROR", "Cần entity và id");
    return ok(buildMockTraceability(mockState, entity, id));
  }),

  http.post(api("/projects/:projectId/flags/recompute"), () =>
    okWithMeta(mockState.spine.flags, {
      checked_at_version: mockState.spine.spine_version,
      opened: [],
      resolved: [],
      reopened: [],
    })
  ),

  http.post(api("/projects/:projectId/flags/:flagId/waive"), async ({ params, request }) => {
    const body = (await request.json()) as { reason: string };
    const flag = mockState.spine.flags.find((f) => f.id === params.flagId);
    if (!flag) return fail(404, "FLAG_NOT_FOUND", "Không tìm thấy cờ");
    if (!body.reason || body.reason.trim().length < 20) return fail(400, "VALIDATION_ERROR", "Lý do cần tối thiểu 20 ký tự");
    if (FLAG_NOT_WAIVABLE_RULES.includes(flag.rule_id as (typeof FLAG_NOT_WAIVABLE_RULES)[number])) {
      return fail(400, "FLAG_NOT_WAIVABLE", "Luật này không cho waive");
    }
    flag.waived_by_user = true;
    flag.waive_reason = body.reason.trim();
    flag.waived_at_version = mockState.spine.spine_version;
    return ok(flag);
  }),

  http.post(api("/projects/:projectId/assemble"), async ({ request }) => {
    const body = (await request.json()) as { base_version: number };
    if (body.base_version !== mockState.spine.spine_version) return conflict(mockState);
    mockAssembledAtVersion = mockState.spine.spine_version;
    return ok({ spine_version: mockState.spine.spine_version, sections: 3, generated_at: new Date().toISOString() });
  }),

  http.get(api("/projects/:projectId/document"), ({ request }) => {
    const url = new URL(request.url);
    const source = url.searchParams.get("source") ?? "draft";
    if (source === "baseline") return fail(404, "BASELINE_NOT_FOUND", "Chưa có baseline nào (T19 chưa nối)");
    if (mockAssembledAtVersion === null) return fail(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu — chạy POST /assemble trước (S-8.2).", { hint: "S-8.2" });
    return okWithMeta(buildMockDocument(mockState), {
      assembled_at_version: mockAssembledAtVersion,
      spine_version: mockState.spine.spine_version,
      stale: mockAssembledAtVersion < mockState.spine.spine_version,
    });
  }),

  http.get(api("/projects/:projectId/export/word"), ({ request }) => {
    const url = new URL(request.url);
    const source = url.searchParams.get("source") ?? "draft";
    if (source === "baseline") return fail(404, "BASELINE_NOT_FOUND", "Chưa có baseline nào (T19 chưa nối)");
    if (mockAssembledAtVersion === null) {
      return fail(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu — chạy POST /assemble trước (S-8.2).", { hint: "S-8.2" });
    }
    return new HttpResponse("mock docx bytes — T16 chỉ giả lập, nội dung thật do T15", {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${mockState.project.name}${source === "draft" ? "-draft" : ""}.docx"`,
        "X-Assembled-At-Version": String(mockAssembledAtVersion),
        "X-Spine-Version": String(mockState.spine.spine_version),
      },
    });
  }),

  http.patch(api("/users/me"), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(mockState.user as unknown as Record<string, unknown>, body);
    return ok(mockState.user);
  }),
];

/** Số step registry mock đang phục vụ — dùng trong test. */
export const MOCK_STEP_COUNT = STEP_REGISTRY.length;
