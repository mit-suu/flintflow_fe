import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamSse } from "../ai-stream";
import * as admin from "./admin";
import * as billing from "./billing";
import * as chat from "./chat";
import { ApiClientError, apiCall, authFetch } from "./client";
import * as documents from "./documents";
import * as exportApi from "./export";
import * as flags from "./flags";
import * as notifications from "./notifications";
import * as pipeline from "./pipeline";
import * as projects from "./projects";
import * as spine from "./spine";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiCall: vi.fn(async () => ({ data: null, error: null })),
  authFetch: vi.fn(),
}));

vi.mock("../ai-stream", () => ({
  streamSse: vi.fn(async () => {}),
}));

const post = (body?: unknown) => ({
  method: "POST",
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

type EndpointCase = [name: string, call: () => unknown, path: string, init?: RequestInit];

const cases: EndpointCase[] = [
  ["listProjects", () => projects.listProjects("active"), "/projects?status=active"],
  ["getProject", () => projects.getProject("p1"), "/projects/p1"],
  ["createProject", () => projects.createProject("App"), "/projects", post({ name: "App" })],
  [
    "renameProject",
    () => projects.renameProject("p1", "Mới"),
    "/projects/p1/name",
    { method: "PATCH", body: JSON.stringify({ name: "Mới" }) },
  ],
  ["deleteProject (archive)", () => projects.deleteProject("p1"), "/projects/p1", { method: "DELETE" }],
  [
    "deleteProject (hard)",
    () => projects.deleteProject("p1", { hard: true }),
    "/projects/p1?hard=true",
    { method: "DELETE" },
  ],
  ["listChatSessions", () => chat.listChatSessions("p1"), "/projects/p1/chats"],
  ["createChatSession", () => chat.createChatSession("p1"), "/projects/p1/chats", post()],
  ["getChatSession", () => chat.getChatSession("p1", "c1"), "/projects/p1/chats/c1"],
  ["deleteChatSession", () => chat.deleteChatSession("p1", "c1"), "/projects/p1/chats/c1", { method: "DELETE" }],
  [
    "rollbackChat",
    () => chat.rollbackChat("p1", "c1", 2),
    "/projects/p1/chats/c1/rollback",
    post({ messageIndex: 2 }),
  ],
  [
    "estimateActionCost",
    () => chat.estimateActionCost("chat_discovery"),
    "/ai-actions/estimate-cost",
    post({ actionType: "chat_discovery" }),
  ],
  ["listProjectDocuments", () => documents.listProjectDocuments("p1"), "/projects/p1/documents"],
  [
    "deleteProjectDocument",
    () => documents.deleteProjectDocument("p1", "d1"),
    "/projects/p1/documents/d1",
    { method: "DELETE" },
  ],
  ["getSpine", () => spine.getSpine("p1"), "/projects/p1/spine"],
  ["listChanges", () => spine.listChanges("p1", { from: 3, to: 9 }), "/projects/p1/changes?from=3&to=9"],
  [
    "previewChanges",
    () => spine.previewChanges("p1", { instruction: "Đổi tên", base_version: 4 }),
    "/projects/p1/changes/preview",
    post({ instruction: "Đổi tên", base_version: 4 }),
  ],
  [
    "applyChanges",
    () => spine.applyChanges("p1", { ops: [{ op: "set", path: "project.name", value: "X" }], base_version: 4 }),
    "/projects/p1/changes",
    post({ ops: [{ op: "set", path: "project.name", value: "X" }], base_version: 4 }),
  ],
  [
    "reconcile (base_version)",
    () => spine.reconcile("p1", { base_version: 4 }),
    "/projects/p1/reconcile",
    post({ base_version: 4 }),
  ],
  [
    "reconcile (base_version + preview_id)",
    () => spine.reconcile("p1", { base_version: 4, preview_id: "pv1" }),
    "/projects/p1/reconcile",
    post({ base_version: 4, preview_id: "pv1" }),
  ],
  [
    "undoLastChange (base_version)",
    () => spine.undoLastChange("p1", { base_version: 4 }),
    "/projects/p1/undo",
    post({ base_version: 4 }),
  ],
  [
    "getTraceability",
    () => spine.getTraceability("p1", { entity: "actor", id: "A01" }),
    "/projects/p1/traceability?entity=actor&id=A01",
  ],
  ["getProgress", () => pipeline.getProgress("p1"), "/projects/p1/progress"],
  ["listSteps", () => pipeline.listSteps("p1"), "/projects/p1/steps"],
  [
    "answerStep",
    () => pipeline.answerStep("p1", "S-3.1", { session_id: "c1", answers: [{ question_id: "q1", answer: "Có" }] }),
    "/projects/p1/steps/S-3.1/answer",
    post({ session_id: "c1", answers: [{ question_id: "q1", answer: "Có" }] }),
  ],
  [
    "submitGate",
    () => pipeline.submitGate("p1", "S-3.1", { session_id: "c1", action: "accept", base_version: 7 }),
    "/projects/p1/steps/S-3.1/gate",
    post({ session_id: "c1", action: "accept", base_version: 7 }),
  ],
  ["resumeProject", () => pipeline.resumeProject("p1"), "/projects/p1/resume", { method: "POST" }],
  ["listFlags", () => flags.listFlags("p1", { level: "red", open: true }), "/projects/p1/flags?level=red&open=true"],
  ["recomputeFlags", () => flags.recomputeFlags("p1"), "/projects/p1/flags/recompute", post()],
  [
    "waiveFlag",
    () => flags.waiveFlag("p1", "f1", "Chấp nhận rủi ro vì phạm vi MVP"),
    "/projects/p1/flags/f1/waive",
    post({ reason: "Chấp nhận rủi ro vì phạm vi MVP" }),
  ],
  [
    "assembleDocument",
    () => exportApi.assembleDocument("p1", 4),
    "/projects/p1/assemble",
    post({ base_version: 4 }),
  ],
  ["getDocument", () => exportApi.getDocument("p1", "baseline"), "/projects/p1/document?source=baseline"],
  ["listBaselines", () => exportApi.listBaselines("p1"), "/projects/p1/baselines"],
  ["createBaseline", () => exportApi.createBaseline("p1", 12), "/projects/p1/baseline", post({ base_version: 12 })],
  ["fetchNotifications", () => notifications.fetchNotifications({ unread: true }), "/notifications?unread=1"],
  ["fetchUnreadCount", () => notifications.fetchUnreadCount(), "/notifications/unread-count"],
  [
    "markNotificationRead",
    () => notifications.markNotificationRead("n1"),
    "/notifications/n1/read",
    { method: "PATCH" },
  ],
  [
    "markAllNotificationsRead",
    () => notifications.markAllNotificationsRead(),
    "/notifications/read-all",
    { method: "PATCH" },
  ],
  // Các hàm billing ném lỗi khi data = null (mock trả null) — chỉ kiểm endpoint
  ["fetchBalance", () => billing.fetchBalance().catch(() => undefined), "/billing/balance"],
  ["fetchPackages", () => billing.fetchPackages().catch(() => undefined), "/billing/packages"],
  [
    "createCheckout",
    () => billing.createCheckout("pkg1").catch(() => undefined),
    "/billing/checkout",
    post({ packageId: "pkg1" }),
  ],
  ["fetchCheckout", () => billing.fetchCheckout("i1").catch(() => undefined), "/billing/checkout/i1"],
  ["upgradePlan", () => billing.upgradePlan("pro").catch(() => undefined), "/billing/upgrade", post({ plan: "pro" })],
  ["fetchTransactions", () => billing.fetchTransactions(2), "/billing/transactions?page=2&limit=20"],
  ["fetchAdminUsers", () => admin.fetchAdminUsers({ page: 2, q: "an" }), "/admin/users?page=2&q=an"],
  // Các hàm admin dưới ném lỗi khi data = null (mock trả null) — chỉ kiểm endpoint
  ["fetchAdminUser", () => admin.fetchAdminUser("u1").catch(() => undefined), "/admin/users/u1"],
  ["fetchAdminMetrics", () => admin.fetchAdminMetrics().catch(() => undefined), "/admin/metrics"],
  [
    "fetchAiCost",
    () => admin.fetchAiCost({ groupBy: "day" }).catch(() => undefined),
    "/admin/ai-cost?groupBy=day",
  ],
  ["fetchAdminFeedback", () => admin.fetchAdminFeedback(), "/admin/feedback"],
];

describe("lib/api wrappers", () => {
  beforeEach(() => {
    vi.mocked(apiCall).mockClear();
    vi.mocked(authFetch).mockReset();
    vi.mocked(streamSse).mockClear();
  });

  it.each(cases)("%s gọi đúng endpoint", async (_name, call, path, init) => {
    await call();

    if (init) {
      expect(apiCall).toHaveBeenCalledWith(path, init);
    } else {
      expect(apiCall).toHaveBeenCalledWith(path);
    }
  });

  it("uploadProjectDocument gửi file qua FormData", async () => {
    const file = new File(["nội dung"], "brief.md", { type: "text/markdown" });

    await documents.uploadProjectDocument("p1", file);

    const [path, init] = vi.mocked(apiCall).mock.calls[0];
    expect(path).toBe("/projects/p1/documents");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBe(file);
  });

  it("runStep mở luồng SSE của step", async () => {
    const handlers = { onEvent: vi.fn() };

    await pipeline.runStep("p1", "S-3.1", { session_id: "c1", base_version: 3 }, handlers);

    expect(streamSse).toHaveBeenCalledWith(
      "/projects/p1/steps/S-3.1/run",
      { session_id: "c1", base_version: 3 },
      handlers
    );
  });

  it("downloadWordExport trả {blob, filename} khi OK; filename đọc từ Content-Disposition", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response("docx-bytes", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="Du-an-v1-draft.docx"' },
      })
    );

    const result = await exportApi.downloadWordExport("p1");

    expect(authFetch).toHaveBeenCalledWith("/projects/p1/export/word?source=draft");
    expect(await result.blob.text()).toBe("docx-bytes");
    expect(result.filename).toBe("Du-an-v1-draft.docx");
  });

  it("downloadWordExport trả filename null khi thiếu Content-Disposition", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(new Response("docx-bytes", { status: 200 }));

    const result = await exportApi.downloadWordExport("p1");

    expect(result.filename).toBeNull();
  });

  it("downloadWordExport gửi baseline_id khi có", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(new Response("docx-bytes", { status: 200 }));

    await exportApi.downloadWordExport("p1", "baseline", "B1");

    expect(authFetch).toHaveBeenCalledWith("/projects/p1/export/word?source=baseline&baseline_id=B1");
  });

  it("downloadWordExport ném lỗi kèm đúng code/thông điệp BE khi chưa có bản ghép (không hard-code EXPORT_FAILED)", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "NO_WORKING_DRAFT", message: "Chưa assemble" }, meta: { hint: "S-8.2" } }), {
        status: 409,
      })
    );

    const promise = exportApi.downloadWordExport("p1");

    await expect(promise).rejects.toBeInstanceOf(ApiClientError);
    await expect(promise).rejects.toMatchObject({ status: 409, code: "NO_WORKING_DRAFT", message: "Chưa assemble (S-8.2)" });
  });

  it("downloadWordExport dùng EXPORT_FAILED khi body lỗi không phải JSON hợp lệ", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(new Response("not json", { status: 500 }));

    const promise = exportApi.downloadWordExport("p1");

    await expect(promise).rejects.toMatchObject({ status: 500, code: "EXPORT_FAILED" });
  });

  it("fetchDiagramSvg trả nội dung SVG", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(new Response("<svg/>", { status: 200 }));

    await expect(spine.fetchDiagramSvg("p1", "D1")).resolves.toBe("<svg/>");
    expect(authFetch).toHaveBeenCalledWith("/projects/p1/diagrams/D1.svg");
  });

  it("fetchDiagramPng trả object URL từ blob PNG", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(new Response("png-bytes", { status: 200 }));
    const createObjectURL = vi.fn(() => "blob:mock-url");
    vi.stubGlobal("URL", { ...URL, createObjectURL });

    await expect(spine.fetchDiagramPng("p1", "D1")).resolves.toBe("blob:mock-url");
    expect(authFetch).toHaveBeenCalledWith("/projects/p1/diagrams/D1.png");

    vi.unstubAllGlobals();
  });

  it("getDocument gửi baseline_id khi có", async () => {
    await exportApi.getDocument("p1", "baseline", "B1");
    expect(apiCall).toHaveBeenCalledWith("/projects/p1/document?source=baseline&baseline_id=B1");
  });
});
