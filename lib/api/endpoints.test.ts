import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamSse } from "../ai-stream";
import * as admin from "./admin";
import * as billing from "./billing";
import * as changeRequests from "./change-requests";
import * as chat from "./chat";
import { ApiClientError, apiCall, authFetch } from "./client";
import * as documents from "./documents";
import * as exportApi from "./export";
import * as files from "./files";
import * as flags from "./flags";
import * as folders from "./folders";
import * as importApi from "./import";
import * as notifications from "./notifications";
import * as pipeline from "./pipeline";
import * as projects from "./projects";
import * as spine from "./spine";
import * as versions from "./versions";

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
  ["createProject (mode 1)", () => projects.createProject("App", "import"), "/projects", post({ name: "App", mode: "import" })],
  [
    "createProject (trong thư mục)",
    () => projects.createProject("App", "fpt", "f1"),
    "/projects",
    post({ name: "App", mode: "fpt", folderId: "f1" }),
  ],
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
  [
    "moveProjectToFolder",
    () => projects.moveProjectToFolder("p1", "f1"),
    "/projects/p1/folder",
    { method: "PATCH", body: JSON.stringify({ folderId: "f1" }) },
  ],
  ["listFolders", () => folders.listFolders(), "/folders"],
  ["createFolder", () => folders.createFolder({ name: "A", color: "blue" }), "/folders", post({ name: "A", color: "blue" })],
  [
    "updateFolder",
    () => folders.updateFolder("f1", { name: "B" }),
    "/folders/f1",
    { method: "PATCH", body: JSON.stringify({ name: "B" }) },
  ],
  ["deleteFolder", () => folders.deleteFolder("f1"), "/folders/f1", { method: "DELETE" }],
  [
    "addProjectsToFolder",
    () => folders.addProjectsToFolder("f1", ["p1", "p2"]),
    "/folders/f1/projects",
    post({ projectIds: ["p1", "p2"] }),
  ],
  ["listChatSessions", () => chat.listChatSessions("p1"), "/projects/p1/chats"],
  ["createChatSession", () => chat.createChatSession("p1"), "/projects/p1/chats", post()],
  ["getChatSession", () => chat.getChatSession("p1", "c1"), "/projects/p1/chats/c1"],
  ["deleteChatSession", () => chat.deleteChatSession("p1", "c1"), "/projects/p1/chats/c1", { method: "DELETE" }],
  [
    "estimateActionCost",
    () => chat.estimateActionCost("chat"),
    "/ai-actions/estimate-cost",
    post({ actionType: "chat" }),
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
  // ─── mode 1: import (#3–#10) — route `/projects/:id/import…` ───
  ["confirmLatest", () => importApi.confirmLatest("p1", "i1"), "/projects/p1/import/confirm-latest", post({ import_id: "i1" })],
  ["getImport", () => importApi.getImport("p1"), "/projects/p1/import"],
  [
    "patchMapping",
    () => importApi.patchMapping("p1", { import_id: "i1", headings: [{ block_id: "B0007", section_id: "fixed:3.1.2" }], confirm_all: true }),
    "/projects/p1/import/mapping",
    { method: "PATCH", body: JSON.stringify({ import_id: "i1", headings: [{ block_id: "B0007", section_id: "fixed:3.1.2" }], confirm_all: true }) },
  ],
  ["startExtraction", () => importApi.startExtraction("p1", "i1"), "/projects/p1/import/extract", post({ import_id: "i1" })],
  [
    "patchFields",
    () => importApi.patchFields("p1", { import_id: "i1", fields: [{ section_id: "fixed:2.1", path: "actors[id=A02].kind", confirmed: true, edited_value: 3 }] }),
    "/projects/p1/import/fields",
    { method: "PATCH", body: JSON.stringify({ import_id: "i1", fields: [{ section_id: "fixed:2.1", path: "actors[id=A02].kind", confirmed: true, edited_value: 3 }] }) },
  ],
  ["finalizeImport", () => importApi.finalizeImport("p1", "i1", 7), "/projects/p1/import/finalize", post({ import_id: "i1", base_version: 7 })],
  ["resumeImport", () => importApi.resumeImport("p1", "i1"), "/projects/p1/import/resume", post({ import_id: "i1" })],
  ["getGapReport", () => importApi.getGapReport("p1"), "/projects/p1/gap-report"],
  // ─── mode 1 v2: step-plan (#32–#33, FLF-182) ───
  ["getStepPlan", () => importApi.getStepPlan("p1"), "/projects/p1/step-plan"],
  [
    "patchStepPlan",
    () => importApi.patchStepPlan("p1", { step_id: "B-0.1", enabled: true }),
    "/projects/p1/step-plan",
    { method: "PATCH", body: JSON.stringify({ step_id: "B-0.1", enabled: true }) },
  ],
  // ─── mode 1: version + release (#12, #13, #15, #31) ───
  ["listVersions", () => versions.listVersions("p1"), "/projects/p1/versions"],
  ["getVersionBlocks", () => versions.getVersionBlocks("p1", "0.1"), "/projects/p1/versions/0.1/blocks"],
  ["getVersionBlocks (mã hoá version)", () => versions.getVersionBlocks("p1", "0.1/x"), "/projects/p1/versions/0.1%2Fx/blocks"],
  ["compareVersions", () => versions.compareVersions("p1", "0.0", "0.1"), "/projects/p1/versions/compare?from=0.0&to=0.1"],
  ["releaseDocument", () => versions.releaseDocument("p1", 12), "/projects/p1/release", post({ base_version: 12 })],
  // ─── mode 1: change request (#16–#30) ───
  [
    "createCr",
    () =>
      changeRequests.createCr("p1", {
        title: "T",
        description: "D",
        source: { kind: "gap_report", ref: "gap-report 0.0", note: null },
        requester: "PM Lan",
      }),
    "/projects/p1/change-requests",
    post({ title: "T", description: "D", source: { kind: "gap_report", ref: "gap-report 0.0", note: null }, requester: "PM Lan" }),
  ],
  ["listCrs", () => changeRequests.listCrs("p1"), "/projects/p1/change-requests"],
  ["listCrs (lọc trạng thái)", () => changeRequests.listCrs("p1", "in_review"), "/projects/p1/change-requests?status=in_review"],
  ["getCr", () => changeRequests.getCr("p1", "CR-001"), "/projects/p1/change-requests/CR-001"],
  ["getCr (mã hoá id)", () => changeRequests.getCr("p1", "CR/1 x"), "/projects/p1/change-requests/CR%2F1%20x"],
  ...(["clarify", "impact", "propose", "verify", "submit", "revise", "resume"] as const).map(
    (action): EndpointCase => [
      `runCrAction ${action}`,
      () => changeRequests.runCrAction("p1", "CR-001", action),
      `/projects/p1/change-requests/CR-001/${action}`,
      post({}),
    ]
  ),
  [
    "answerClarifications",
    () => changeRequests.answerClarifications("p1", "CR-001", ["Có", "Mọi thiết bị"]),
    "/projects/p1/change-requests/CR-001/answers",
    post({ answers: ["Có", "Mọi thiết bị"] }),
  ],
  [
    "patchLocation",
    () => changeRequests.patchLocation("p1", "CR-001", "L002", { conclusion: "not_related", reason: "Chỉ nhắc tên" }),
    "/projects/p1/change-requests/CR-001/locations/L002",
    { method: "PATCH", body: JSON.stringify({ conclusion: "not_related", reason: "Chỉ nhắc tên" }) },
  ],
  [
    "decideGroup",
    () => changeRequests.decideGroup("p1", "CR-001", "G1", { decision: "rejected", reason: "Ngoài phạm vi 1.0", base_version: 9 }),
    "/projects/p1/change-requests/CR-001/groups/G1/decision",
    post({ decision: "rejected", reason: "Ngoài phạm vi 1.0", base_version: 9 }),
  ],
  [
    "closeCr",
    () => changeRequests.closeCr("p1", "CR-001", "Stakeholder rút yêu cầu"),
    "/projects/p1/change-requests/CR-001/close",
    post({ reason: "Stakeholder rút yêu cầu" }),
  ],
  [
    "cancelCr",
    () => changeRequests.cancelCr("p1", "CR-001", "Tạo nhầm change request"),
    "/projects/p1/change-requests/CR-001/cancel",
    post({ reason: "Tạo nhầm change request" }),
  ],
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
<<<<<<< HEAD
=======

  it("uploadImport / reuploadDocument gửi file .docx qua FormData field `file`", async () => {
    const file = new File(["PK"], "SRS.docx");

    await importApi.uploadImport("p1", file);
    await importApi.reuploadDocument("p1", file);

    const [[uploadPath, uploadInit], [reuploadPath, reuploadInit]] = vi.mocked(apiCall).mock.calls;
    expect(uploadPath).toBe("/projects/p1/import");
    expect(uploadInit?.method).toBe("POST");
    expect((uploadInit?.body as FormData).get("file")).toBe(file);
    expect(reuploadPath).toBe("/projects/p1/reupload");
    expect(reuploadInit?.method).toBe("POST");
    expect((reuploadInit?.body as FormData).get("file")).toBe(file);
  });

  it("downloadGapReport tải `?format=docx` qua authFetch, tên file từ Content-Disposition", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response("docx", { status: 200, headers: { "Content-Disposition": 'attachment; filename="Lumen_gap-report.docx"' } })
    );

    const result = await importApi.downloadGapReport("p1");

    expect(authFetch).toHaveBeenCalledWith("/projects/p1/gap-report?format=docx");
    expect(result.filename).toBe("Lumen_gap-report.docx");
    expect(await result.blob.text()).toBe("docx");
  });

  it("downloadVersion: mặc định variant=auto; tracked khi yêu cầu", async () => {
    vi.mocked(authFetch).mockImplementation(async () => new Response("docx", { status: 200 }));

    await versions.downloadVersion("p1", "0.2");
    await versions.downloadVersion("p1", "1.0", "tracked");

    expect(vi.mocked(authFetch).mock.calls.map((c) => c[0])).toEqual([
      "/projects/p1/versions/0.2/download?variant=auto",
      "/projects/p1/versions/1.0/download?variant=tracked",
    ]);
  });

  it("fetchFile lỗi ⇒ ApiClientError mang code/meta của envelope; body không phải JSON ⇒ DOWNLOAD_FAILED", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "DOC_VERSION_NOT_FOUND", message: "Không có version 0.9" }, meta: { version: "0.9" } }), {
        status: 404,
      })
    );
    const failed = files.fetchFile("/projects/p1/versions/0.9/download?variant=auto");
    await expect(failed).rejects.toBeInstanceOf(ApiClientError);
    await expect(failed).rejects.toMatchObject({ status: 404, code: "DOC_VERSION_NOT_FOUND", meta: { version: "0.9" } });

    vi.mocked(authFetch).mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    await expect(files.fetchFile("/x")).rejects.toMatchObject({ status: 502, code: "DOWNLOAD_FAILED", message: "HTTP 502" });
  });

  it("parseContentDispositionFilename: ưu tiên filename* UTF-8, rồi filename thường; thiếu ⇒ null", () => {
    const parse = files.parseContentDispositionFilename;
    expect(parse(null)).toBeNull();
    expect(parse("attachment")).toBeNull();
    expect(parse('attachment; filename="SRS_v0.1_DRAFT.docx"')).toBe("SRS_v0.1_DRAFT.docx");
    expect(parse("attachment; filename=SRS.docx")).toBe("SRS.docx");
    expect(parse(`attachment; filename="fallback.docx"; filename*=UTF-8''D%E1%BB%B1%20%C3%A1n_v1.0.docx`)).toBe("Dự án_v1.0.docx");
    // mã hoá hỏng ⇒ giữ nguyên chuỗi
    expect(parse("attachment; filename*=UTF-8''bad%E0%A4%A.docx")).toBe("bad%E0%A4%A.docx");
  });

  it("saveBlob gắn link tải tạm vào DOM, click, gỡ ra và thu hồi object URL", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const seen: { connected: boolean; download: string; href: string | null }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ connected: this.isConnected, download: this.download, href: this.getAttribute("href") });
    });

    files.saveBlob(new Blob(["x"]), "SRS_v1.0.docx");

    expect(seen).toEqual([{ connected: true, download: "SRS_v1.0.docx", href: "blob:mock" }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
});
