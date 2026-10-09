import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeOption } from "@/lib/question-options";
import { getSpine, applyChanges } from "@/lib/api/spine";
import { getProject, setDocumentLanguage } from "@/lib/api/projects";
import { answerStep, getProgress, listSteps, resumeProject, runStep, submitGate } from "@/lib/api/pipeline";
import { getDocument } from "@/lib/api/export";
import { getTranslationStatus, runTranslation } from "@/lib/api/translations";
import type { StepEvent } from "@/types/pipeline";
import { MOCK_TRANSLATION_UNITS, mockTiming, mockTranslation, resetMockTranslationState } from "./handlers";
import { mockServer } from "./server";
import { MOCK_PROJECT_ID, MOCK_SESSION_ID, mockState, resetMockState } from "./state";
import { apiCall } from "@/lib/api";
import type { ChatSession } from "@/types/chat";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => resetMockState());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

/** Chạy một step trên mock: tự trả lời câu hỏi nếu có, trả về danh sách sự kiện. */
const runToGate = async (stepId: string): Promise<StepEvent[]> => {
  const events: StepEvent[] = [];
  const base_version = await version();
  await runStep(P, stepId, { session_id: MOCK_SESSION_ID, base_version }, {
    onEvent: (event) => {
      events.push(event);
      if (event.type === "answer_needed") {
        void answerStep(P, stepId, {
          session_id: MOCK_SESSION_ID,
          answers: event.questions.map((q) => ({ question_id: q.id, answer: q.options?.[0] ? normalizeOption(q.options[0]).label : "Có" })),
        });
      }
    },
  });
  return events;
};

describe("mock pipeline theo contract (DoD T12)", () => {
  it("bắt đầu ở S-3.1; GET /steps và /progress đúng hình", async () => {
    const steps = (await listSteps(P)).data!;
    expect(steps.current_step).toBe("S-3.1");
    expect(steps.steps.find((s) => s.id === "S-2.5")?.status).toBe("accepted");
    expect(steps.steps.find((s) => s.id === "S-3.1")).toMatchObject({ status: "pending", regenerate_limit: 3, calls_limit: 8 });

    const progress = (await getProgress(P)).data!;
    expect(progress.progress).toMatchObject({ current_step: "S-3.1", show_percent: false });
  });

  it("đi trọn S-3.1 → S-3.6 với gate từng step", async () => {
    for (const stepId of ["S-3.1", "S-3.2", "S-3.3", "S-3.4", "S-3.5", "S-3.6"]) {
      const events = await runToGate(stepId);
      const types = events.map((e) => e.type);
      expect(types[0], stepId).toBe("intake");
      expect(types[types.length - 1], stepId).toBe("gate_ready");
      if (stepId === "S-3.6") expect(types).toContain("render");

      const gate = await submitGate(P, stepId, { session_id: MOCK_SESSION_ID, action: "accept", base_version: await version() });
      expect(gate.data?.step.status, stepId).toBe("accepted");
    }
    const steps = (await listSteps(P)).data!;
    expect(steps.current_step).toBe("S-4.1");
    const spine = (await getSpine(P)).data!;
    expect(spine.actors.map((a) => a.id)).toEqual(["A01", "A02"]);
    expect(spine.use_cases.every((u) => u.description.length > 0)).toBe(true);
  });

  it("Regenerate lần 4 bị từ chối; Accept as-is đòi ghi chú và chỉ mở khi hết Regenerate", async () => {
    await runToGate("S-3.1");
    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", note: "ok", base_version: await version() })).rejects.toMatchObject({
      code: "STEP_NOT_RUNNABLE",
    });

    for (let i = 1; i <= 3; i++) {
      const res = await submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "regenerate", base_version: await version() });
      expect(res.data?.step.regenerate_used).toBe(i);
      const events = await runToGate("S-3.1");
      const gateReady = events.find((e) => e.type === "gate_ready");
      expect(gateReady && gateReady.type === "gate_ready" && gateReady.actions.includes("regenerate")).toBe(i < 3);
    }

    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "regenerate", base_version: await version() })).rejects.toMatchObject({
      code: "REGENERATE_LIMIT",
      status: 409,
    });
    await expect(submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", base_version: await version() })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const asIs = await submitGate(P, "S-3.1", { session_id: MOCK_SESSION_ID, action: "accept_as_is", note: "Chấp nhận mô tả hiện tại", base_version: await version() });
    expect(asIs.data?.step.status).toBe("accepted");
  });

  it("gate thiếu session_id ⇒ 400, session phụ ⇒ 403 NOT_PIPELINE_SESSION (contract-change 2026-09-15)", async () => {
    const base_version = await version();
    await expect(submitGate(P, "S-3.1", { session_id: "", action: "accept", base_version })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(submitGate(P, "S-3.1", { session_id: "other-session", action: "accept", base_version })).rejects.toMatchObject({
      code: "NOT_PIPELINE_SESSION",
      status: 403,
    });
  });

  it("FLF-244: /run từ session phụ ⇒ 403 NOT_PIPELINE_SESSION", async () => {
    const base_version = await version();
    await expect(runStep(P, "S-3.1", { session_id: "other-session", base_version }, { onEvent: () => {} })).rejects.toMatchObject({
      code: "NOT_PIPELINE_SESSION",
      status: 403,
    });
  });

  it("FLF-244: GET /chats chỉ kèm tin cuối; xoá phiên chính ⇒ 409 PIPELINE_SESSION_LOCKED", async () => {
    mockState.sessions[0].messages = [
      { role: "user", content: "một", createdAt: "2026-10-01T00:00:00Z" },
      { role: "ai", content: "hai", createdAt: "2026-10-01T00:00:01Z" },
    ];
    const list = await apiCall<ChatSession[]>(`/projects/${P}/chats`);
    expect(list.data?.[0].messages.map((m) => m.content)).toEqual(["hai"]);
    await expect(apiCall(`/projects/${P}/chats/${MOCK_SESSION_ID}`, { method: "DELETE" })).rejects.toMatchObject({
      code: "PIPELINE_SESSION_LOCKED",
      status: 409,
    });
  });

  it("POST /resume trả reverted_step + spine_version hiện tại", async () => {
    const res = await resumeProject(P);
    expect(res.data).toMatchObject({ reverted_step: null, spine_version: await version() });
    expect(res.data?.progress.progress.total).toBeGreaterThan(0);
  });

  it("base_version cũ ⇒ 409; POST /changes ops thuần tăng version", async () => {
    await expect(runStep(P, "S-3.1", { session_id: MOCK_SESSION_ID, base_version: 1 }, { onEvent: () => {} })).rejects.toThrow();

    const before = await version();
    const res = await applyChanges(P, { base_version: before, ops: [{ op: "set", path: "project.review_mode", value: "strict" }] });
    expect(res.data).toMatchObject({ spine_version: before + 1 });
    expect(res.data?.spine.project.review_mode).toBe("strict");
    await expect(applyChanges(P, { base_version: before, ops: [{ op: "set", path: "project.name", value: "X" }] })).rejects.toMatchObject({
      code: "SPINE_VERSION_CONFLICT",
    });
  });
});

describe("mock PATCH /projects/:id/document-language (FLF-265 #1a)", () => {
  it("project mode 2 ⇒ đổi và GET trả field mới; giá trị lạ ⇒ 400", async () => {
    expect((await setDocumentLanguage(P, "vi")).data?.documentLanguage).toBe("vi");
    expect((await getProject(P)).data?.documentLanguage).toBe("vi");
    await expect(setDocumentLanguage(P, "fr" as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("project mode import ⇒ 409 DOCUMENT_LANGUAGE_LOCKED, không đổi gì", async () => {
    mockState.project = { ...mockState.project, mode: "import" };
    await expect(setDocumentLanguage(P, "vi")).rejects.toMatchObject({ code: "DOCUMENT_LANGUAGE_LOCKED", status: 409 });
    expect(mockState.project.documentLanguage).toBeUndefined();
  });
});

describe("mock dịch tài liệu theo lô (FLF-265 #16, #26, #27)", () => {
  beforeEach(() => resetMockTranslationState());

  it("dự án en (ngôn ngữ gốc) ⇒ GET /document không có meta.translation, status total 0, run không làm gì", async () => {
    expect((await getDocument(P)).meta?.translation).toBeUndefined();
    expect((await getTranslationStatus(P)).data).toEqual({ locale: "en", source_locale: "en", total: 0, missing: 0, batches: 0, estimated_credits: 0 });
    expect((await runTranslation(P)).data).toEqual({ translated: 0, remaining: 0, credits_used: 0 });
  });

  it("đổi sang vi ⇒ meta.translation + ước tính; run dịch dần theo max_batches tới remaining 0", async () => {
    await setDocumentLanguage(P, "vi");
    expect((await getDocument(P)).meta?.translation).toEqual({ locale: "vi", source_locale: "en", missing: MOCK_TRANSLATION_UNITS });
    expect((await getTranslationStatus(P)).data).toMatchObject({ locale: "vi", source_locale: "en", missing: 100, batches: 3, estimated_credits: 6 });

    expect((await runTranslation(P, 1)).data).toEqual({ translated: 40, remaining: 60, credits_used: 2 });
    expect((await runTranslation(P)).data).toEqual({ translated: 60, remaining: 0, credits_used: 4 });
    expect((await getDocument(P)).meta?.translation).toEqual({ locale: "vi", source_locale: "en", missing: 0 });
    await expect(runTranslation(P, 11)).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("lỗi bật được theo lượt: 402 / 409 / 422 / 403, và lượt không tiến (translated 0)", async () => {
    await setDocumentLanguage(P, "vi");
    mockTranslation.failure = "INSUFFICIENT_CREDIT";
    mockTranslation.failFromCall = 2;
    expect((await runTranslation(P, 1)).data?.translated).toBe(40);
    await expect(runTranslation(P)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDIT", status: 402 });

    for (const [failure, status] of [["TRANSLATION_RUNNING", 409], ["PARSE_FAILED", 422], ["SCHEMA_MISMATCH", 422], ["ORG_ROLE_FORBIDDEN", 403]] as const) {
      mockTranslation.failure = failure;
      await expect(runTranslation(P)).rejects.toMatchObject({ code: failure, status });
    }
    mockTranslation.failure = "stalled";
    expect((await runTranslation(P)).data).toEqual({ translated: 0, remaining: 60, credits_used: 2 });
  });
});
