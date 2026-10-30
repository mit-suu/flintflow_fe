// @vitest-environment node
// Môi trường node: FormData/Blob của jsdom làm mất tên file khi gửi multipart (tên thành "blob").
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import type { CrDetail } from "@/types/change-request";
import type { DocBlock, ExtractResponse, GapReport, GetImportResponse, ImportStateResponse, ReuploadDiff } from "@/types/import";
import type { CompareResponse, DocVersion, ReleaseResponse } from "@/types/doc-version";
import type { Project } from "@/types/project";
import { mockServer } from "../server";
import { MOCK_PROJECT_ID, resetMockState } from "../state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "./state";
import * as stateModule from "./state";

const P = MODE1_PROJECT_ID;

interface Envelope<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code: string; message: string } | null;
}

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: Envelope<T>; headers: Headers }> => {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  const isJson = res.headers.get("content-type")?.includes("json");
  return { status: res.status, body: (isJson ? await res.json() : { data: null, error: null }) as Envelope<T>, headers: res.headers };
};

const upload = (name: string) => {
  const form = new FormData();
  form.append("file", new Blob(["PK mock"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), name);
  return form;
};

const state = () => stateModule.mode1State;

/** Poll #4 như FE (FLF-343, một mạch): tới khi rời extracting / baselining / checking hoặc bị `paused`. */
const pollImport = async (): Promise<GetImportResponse> => {
  for (let i = 0; i < 60; i++) {
    const got = (await call<GetImportResponse>("GET", `/projects/${P}/import`)).body.data!;
    if (!["extracting", "baselining", "checking"].includes(got.import!.status) || got.import!.paused) return got;
  }
  throw new Error("lượt import không kết thúc sau 60 lần poll");
};

/** Upload ⇒ Bắt đầu (kèm xác nhận bản mới nhất) ⇒ gap_review, trả về import_id. */
const importToGapReview = async (): Promise<string> => {
  const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS_Lumen.docx"));
  const id = up.body.data!.import.id;
  await call("POST", `/projects/${P}/import/extract`, { import_id: id, confirm_latest: true });
  await pollImport();
  return id;
};

const createCr = async (title: string, description = "Logging out must sign the user out of all devices.") =>
  (await call<CrDetail>("POST", `/projects/${P}/change-requests`, { title, description, source: { kind: "stakeholder_email" }, requester: "PM Lan" })).body.data!;

/** CR từ draft tới `ready_to_submit` (đã kiểm, chưa xác nhận). */
const crToReady = async (title: string): Promise<CrDetail> => {
  const { cr_id } = (await createCr(title)).change_request;
  const base = `/projects/${P}/change-requests/${cr_id}`;
  for (const step of ["clarify", "impact", "propose", "verify"]) {
    const res = await call<CrDetail>("POST", `${base}/${step}`, {});
    expect(res.status, `${step}: ${JSON.stringify(res.body.error)}`).toBe(200);
  }
  return (await call<CrDetail>("GET", base)).body.data!;
};

/** CR từ draft tới written (FLF-330: BA xác nhận là ghi ngay). */
const crToReview = async (title: string): Promise<CrDetail> => {
  const ready = await crToReady(title);
  const base = `/projects/${P}/change-requests/${ready.change_request.cr_id}`;
  const res = await call<CrDetail>("POST", `${base}/submit`, {});
  expect(res.status, `submit: ${JSON.stringify(res.body.error)}`).toBe(200);
  return res.body.data!;
};

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("mock mode 1 — project theo mode (#1)", () => {
  it("FLF-335: source quyết định mode — có sẵn ⇒ import; mới có mẫu bắt buộc ⇒ import + template_intent fixed; mới không mẫu ⇒ fpt; client cũ gửi mode vẫn chạy, mode lạ ⇒ 400", async () => {
    const created = await call<Project>("POST", "/projects", { name: "Lumen", source: "existing" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ mode: "import", import_state: null, start_kind: "existing", template_intent: null });
    expect((await call<Project>("POST", "/projects", { name: "X", source: "new", has_required_template: true })).body.data).toMatchObject({ mode: "import", template_intent: "fixed" });
    expect((await call<Project>("POST", "/projects", { name: "X", source: "new", has_required_template: false })).body.data).toMatchObject({ mode: "fpt", has_required_template: false });
    expect((await call<Project>("POST", "/projects", { name: "X", mode: "import" })).body.data?.mode).toBe("import");
    expect((await call("POST", "/projects", { name: "X", source: "later" })).status).toBe(400);
    expect((await call("POST", "/projects", { name: "X", mode: "coaching" })).status).toBe(400);
    expect((await call<Project>("POST", "/projects", { name: "Y" })).body.data?.mode).toBe("fpt");
  });

  it("GET project mode 1 trả mode import; project mode 2 vẫn do mock pipeline trả", async () => {
    expect((await call<Project>("GET", `/projects/${P}`)).body.data?.mode).toBe("import");
    expect((await call<Project>("GET", `/projects/${MOCK_PROJECT_ID}`)).body.data?.mode).toBe("fpt");
  });

  it("FLF-265: POST trả lại documentLanguage; thiếu ⇒ en; mode import không có field; giá trị lạ ⇒ 400", async () => {
    expect((await call<Project>("POST", "/projects", { name: "A", mode: "fpt", documentLanguage: "vi" })).body.data?.documentLanguage).toBe("vi");
    expect((await call<Project>("POST", "/projects", { name: "B", mode: "fpt" })).body.data?.documentLanguage).toBe("en");
    const imported = (await call<Project>("POST", "/projects", { name: "C", mode: "import", documentLanguage: "vi" })).body.data!;
    expect(imported).not.toHaveProperty("documentLanguage");
    expect((await call("POST", "/projects", { name: "D", documentLanguage: "fr" })).status).toBe(400);
  });

  it("FLF-265: PATCH document-language — project import ⇒ 409 DOCUMENT_LANGUAGE_LOCKED; project mode 2 vừa tạo ⇒ đổi", async () => {
    const locked = await call("PATCH", `/projects/${P}/document-language`, { documentLanguage: "vi" });
    expect(locked.status).toBe(409);
    expect(locked.body.error?.code).toBe("DOCUMENT_LANGUAGE_LOCKED");

    const fpt = (await call<Project>("POST", "/projects", { name: "E", mode: "fpt", documentLanguage: "en" })).body.data!;
    const changed = await call<Project>("PATCH", `/projects/${fpt._id}/document-language`, { documentLanguage: "vi" });
    expect(changed.body.data?.documentLanguage).toBe("vi");
    expect((await call<Project>("GET", `/projects/${fpt._id}`)).body.data?.documentLanguage).toBe("vi");
    // body strict: key lạ ⇒ 400
    expect((await call("PATCH", `/projects/${fpt._id}/document-language`, { documentLanguage: "vi", mode: "fpt" })).status).toBe(400);
  });

  it("API mode 1 trên project mode 2 ⇒ 409 PROJECT_MODE_MISMATCH", async () => {
    const res = await call("GET", `/projects/${MOCK_PROJECT_ID}/import`);
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("PROJECT_MODE_MISMATCH");
  });
});

describe("mock mode 1 — import (#2–#10)", () => {
  it("preflight từ chối kèm vị trí; .doc bị nhận là LEGACY_DOC", async () => {
    const tracked = await call("POST", `/projects/${P}/import`, upload("SRS_tracked.docx"));
    expect(tracked.status).toBe(422);
    expect(tracked.body.error?.code).toBe("IMPORT_FILE_REJECTED");
    expect(tracked.body.meta?.issues).toEqual([expect.objectContaining({ code: "FOREIGN_TRACK_CHANGE", location: expect.any(Object) })]);
    const legacy = await call("POST", `/projects/${P}/import`, upload("old.doc"));
    expect((legacy.body.meta?.issues as { code: string }[])[0].code).toBe("LEGACY_DOC");
    expect((await call("POST", `/projects/${P}/import`, upload("other-project.docx"))).body.error?.code).toBe("IMPORT_STAMP_FOREIGN_PROJECT");
  });

  it("FLF-343 đi trọn một mạch: upload ⇒ tách file + ước tính (I-4 + kiểm tra) ⇒ Bắt đầu kèm xác nhận ⇒ gap_review; field độ tin thấp ⇒ cờ Cần xem", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS_Lumen.docx"));
    expect(up.status).toBe(201);
    const id = up.body.data!.import.id;
    expect(up.body.data!.import).toMatchObject({ status: "extracting", confirmed_latest_at: null, extract_cursor: null });

    const got = (await call<GetImportResponse>("GET", `/projects/${P}/import`)).body.data!;
    expect(got.blocks_count).toBe(12);
    // mapping độ tin thấp tự nhận, giữ độ tin
    const low = got.profile!.heading_map.filter((h) => h.confidence < 0.8);
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((h) => h.confirmed && h.auto_confirmed)).toBe(true);
    // ước tính một lần: mỗi section một lượt (2) + một lượt kiểm tra (3), số dư của ví
    expect(got.credit_estimate).toMatchObject({ diagram_images: 0, check_calls: 1, available_credits: state().credits });
    expect(got.credit_estimate!.credits).toBe((got.credit_estimate!.ai_calls - 1) * 2 + 3);

    // không xác nhận bản mới nhất ⇒ không chạy
    expect((await call("POST", `/projects/${P}/import/extract`, { import_id: id })).body.error?.code).toBe("IMPORT_NEEDS_LATEST_CONFIRM");
    const extracted = await call<ExtractResponse>("POST", `/projects/${P}/import/extract`, { import_id: id, confirm_latest: true });
    // #6 trả ngay: vẫn extracting, chưa section nào xong — tiến độ xem qua poll #4
    expect(extracted.body.data!.import).toMatchObject({ status: "extracting", paused: null });
    expect(extracted.body.data!.sections.every((s) => s.status === "pending")).toBe(true);
    const done = await pollImport();
    expect(done.import).toMatchObject({ status: "gap_review", paused: null });
    expect(state().baselines.filter((b) => b.type === "imported")).toHaveLength(1);
    expect((await call<Project>("GET", `/projects/${P}`)).body.data?.import_state).toBe("gap_review");
    expect(state().credits).toBe(100 - got.credit_estimate!.credits);
    const flags = (await call<{ rule_id: string; target_id: string | null }[]>("GET", `/projects/${P}/flags`)).body.data!;
    expect(flags.filter((f) => f.rule_id === "import_needs_review").map((f) => f.target_id)).toEqual(["actors[id=A02].kind"]);

    const report = (await call<GapReport>("GET", `/projects/${P}/gap-report`)).body.data!;
    expect(report.totals.red).toBe(1);
    expect(report).not.toHaveProperty("missing_fpt_sections");
    const docx = await call("GET", `/projects/${P}/gap-report?format=docx`);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("hết credit giữa lúc trích ⇒ paused + cursor; resume không trích lại section đã xong, chạy tiếp tới gap_review", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS.docx"));
    const id = up.body.data!.import.id;
    state().credits = 4; // đủ 2 section
    expect((await call<ExtractResponse>("POST", `/projects/${P}/import/extract`, { import_id: id, confirm_latest: true })).body.data!.import.paused).toBeNull();
    const paused = await pollImport();
    expect(paused.import!.paused?.reason).toBe("credits");
    const sections = paused.extraction.sections;
    expect(paused.import!.extract_cursor).toBe(sections[2].section_id);
    expect(sections.filter((s) => s.status === "done")).toHaveLength(2);
    // dừng ⇒ ước tính phần còn lại (+ kiểm tra), số dư không đủ
    expect(paused.credit_estimate).toMatchObject({ ai_calls: sections.length - 2 + 1, credits: 2 * (sections.length - 2) + 3, available_credits: 0 });

    state().credits = 100;
    const resumed = (await call<ExtractResponse>("POST", `/projects/${P}/import/resume`, { import_id: id })).body.data!;
    expect(resumed.import).toMatchObject({ status: "extracting", paused: null });
    const done = await pollImport();
    expect(done.import).toMatchObject({ status: "gap_review", paused: null });
    expect(done.extraction.sections.every((s) => s.status === "done")).toBe(true);
    expect(state().credits).toBe(100 - paused.credit_estimate!.credits);
    expect(done.credit_estimate).toBeNull();
  });

  it("gọi #6 hai lần khi job đang chạy không bật job thứ hai, không trích lại", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS.docx"));
    const id = up.body.data!.import.id;
    await call("POST", `/projects/${P}/import/extract`, { import_id: id, confirm_latest: true });
    await call("GET", `/projects/${P}/import`);
    await call("POST", `/projects/${P}/import/extract`, { import_id: id });
    const done = await pollImport();
    expect(state().credits).toBe(100 - 2 * done.extraction.sections.length - 3);
  });

  it("đã có baseline thì /import từ chối, /reupload trả diff và không tạo version", async () => {
    await importToGapReview();
    expect((await call("POST", `/projects/${P}/import`, upload("SRS_v2.docx"))).body.error?.code).toBe("IMPORT_INVALID_STATE");
    const diff = await call<ReuploadDiff>("POST", `/projects/${P}/reupload`, upload("SRS_v0.0_sua.docx"));
    expect(diff.status).toBe(201);
    expect(diff.body.data).toMatchObject({ against_version: "0.1", summary: { added: 1, modified: 1 } });
    expect((await call<DocVersion[]>("GET", `/projects/${P}/versions`)).body.data).toHaveLength(1);
  });
});

describe("mock mode 1 — change request (#16–#30)", () => {
  beforeEach(async () => {
    await importToGapReview();
  });

  it("chưa có baseline ⇒ CR_REQUIRES_BASELINE; thiếu nguồn ⇒ CR_SOURCE_REQUIRED", async () => {
    resetMode1MockState();
    expect((await call("POST", `/projects/${P}/change-requests`, { title: "a", description: "b", source: { kind: "verbal" }, requester: "x" })).body.error?.code).toBe("CR_REQUIRES_BASELINE");
    await importToGapReview();
    expect((await call("POST", `/projects/${P}/change-requests`, { title: "a", description: "b", requester: "x" })).body.error?.code).toBe("CR_SOURCE_REQUIRED");
  });

  it("mơ hồ ⇒ hỏi lại; trả lời đủ câu ⇒ impact_review", async () => {
    const { cr_id } = (await createCr("Đăng xuất", "Yêu cầu còn mơ hồ về phạm vi thiết bị")).change_request;
    const base = `/projects/${P}/change-requests/${cr_id}`;
    const asked = (await call<CrDetail>("POST", `${base}/clarify`, {})).body.data!;
    expect(asked.change_request.status).toBe("awaiting_answers");
    expect(asked.pending_questions).toHaveLength(2);
    expect((await call("POST", `${base}/answers`, { answers: ["Có"] })).status).toBe(400);
    const clear = (await call<CrDetail>("POST", `${base}/answers`, { answers: ["Có, cả mobile", "Không cần"] })).body.data!;
    expect(clear.change_request.status).toBe("impact_review");
    expect(clear.change_request.clarifications[0].answers).toHaveLength(2);
  });

  // FLF-279 phần B (§4.17): ứng viên vector THAY nguồn `keyword`; tắt (mặc định, `EMBEDDING_PROVIDER=off`)
  // thì vị trí phải y như trước.
  it("vector tắt ⇒ vị trí vẫn tìm bằng từ khoá, không có vector_score", async () => {
    const detail = await crToReview("Log out of all devices");

    expect(detail.locations.length).toBeGreaterThan(0);
    expect(detail.locations.every((l) => l.found_by.includes("keyword"))).toBe(true);
    expect(detail.locations.some((l) => l.found_by.includes("vector"))).toBe(false);
    expect(detail.locations.every((l) => l.vector_score === null)).toBe(true);
  });

  it("vector bật ⇒ vector thay keyword, có vector_score, và vị trí đầu vừa spine_link vừa vector", async () => {
    state().vectorEnabled = true;
    const detail = await crToReview("Log out of all devices");

    expect(detail.locations.every((l) => l.found_by.includes("keyword"))).toBe(false);
    expect(detail.locations.every((l) => l.found_by.includes("vector"))).toBe(true);
    expect(detail.locations.every((l) => typeof l.vector_score === "number")).toBe(true);
    expect(detail.locations[0].found_by).toEqual(["spine_link", "vector"]);
    expect(detail.locations[0].vector_score).toBeCloseTo(0.91);
  });

  it("đi trọn CR (FLF-186): khoá phần tử Spine, CR thứ hai chạm cùng phần tử ⇒ PATH_LOCKED; BA xác nhận ⇒ phần tử đổi, 0.2, mở khoá (FLF-330)", async () => {
    const detail = await crToReady("Log out of all devices");
    expect(detail.change_request.status).toBe("ready_to_submit");
    const locked = detail.locations.map((l) => l.path);
    expect(locked.length).toBeGreaterThan(0);
    expect(locked.every((p) => state().locks.get(p) === detail.change_request.cr_id)).toBe(true);
    expect(detail.locations[0].current_text).toContain("\"id\"");

    const other = (await createCr("Log out of all devices again")).change_request.cr_id;
    await call("POST", `/projects/${P}/change-requests/${other}/clarify`, {});
    const conflict = await call("POST", `/projects/${P}/change-requests/${other}/impact`, {});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("PATH_LOCKED");
    expect(conflict.body.meta?.locked).toEqual(expect.arrayContaining([expect.objectContaining({ cr_id: detail.change_request.cr_id })]));

    const base = `/projects/${P}/change-requests/${detail.change_request.cr_id}`;
    // FLF-330 C-6: xác nhận là ghi ngay — không còn duyệt từng group
    const written = (await call<CrDetail>("POST", `${base}/submit`, {})).body.data!;
    expect(written.change_request).toMatchObject({ status: "written", result_doc_version: "0.2" });
    expect(written.groups.every((g) => g.decision === "approved")).toBe(true);
    expect((await call("POST", `${base}/groups/G01/decision`, { decision: "approved", reason: "Đúng yêu cầu của khách", base_version: state().spineVersion })).status).toBe(409);

    // giá trị phần tử đã đổi theo đề xuất; khoá của CR mở hết
    const edited = written.locations.find((l) => l.conclusion === "edit")!;
    expect(written.locations.find((l) => l.location_id === edited.location_id)?.current_text).toBe(edited.proposal?.new_text);
    expect([...state().locks.values()]).not.toContain(detail.change_request.cr_id);
    expect((await call<DocBlock[]>("GET", `/projects/${P}/versions/0.2/blocks`)).status).toBe(200);
    expect((await call<CompareResponse>("GET", `/projects/${P}/versions/compare?from=0.1&to=0.2`)).status).toBe(200);
    const dl = await call("GET", `/projects/${P}/versions/0.2/download`);
    expect(dl.headers.get("content-disposition")).toContain("_v0.2_DRAFT.docx");
  });

  it("nộp khi còn vị trí chưa kết luận ⇒ CR_LOCATION_UNCONCLUDED", async () => {
    const { cr_id } = (await createCr("Log out of all devices")).change_request;
    const base = `/projects/${P}/change-requests/${cr_id}`;
    await call("POST", `${base}/clarify`, {});
    await call("POST", `${base}/impact`, {});
    const res = await call("POST", `${base}/submit`, {});
    expect(res.body.error?.code).toBe("CR_LOCATION_UNCONCLUDED");
    expect((res.body.meta?.location_ids as string[]).length).toBeGreaterThan(0);
  });

  it("verify trượt: AI làm lại 2 lần rồi manual_fix; sửa tay xong verify đạt", async () => {
    const { cr_id } = (await createCr("FAIL log out of all devices")).change_request;
    const base = `/projects/${P}/change-requests/${cr_id}`;
    for (const step of ["clarify", "impact", "propose"]) await call("POST", `${base}/${step}`, {});
    const statuses: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = (await call<CrDetail>("POST", `${base}/verify`, {})).body.data!;
      statuses.push(res.change_request.status);
      if (res.change_request.status === "proposing") await call("POST", `${base}/propose`, {});
    }
    expect(statuses).toEqual(["proposing", "proposing", "manual_fix"]);
    const fixed = await call<CrDetail>("PATCH", `${base}/locations/L001`, { conclusion: "edit", new_value: { id: "NFR-P02", statement: "Sign out of all devices" } });
    expect(fixed.body.data!.locations[0].manual).toBe(true);
    expect((await call<CrDetail>("POST", `${base}/verify`, {})).body.data!.change_request.status).toBe("ready_to_submit");
  });

  it("luồng cũ (CR in_review trước FLF-330): mọi group bị từ chối ⇒ đóng (rejected) và mở khoá; huỷ CR khác cũng mở khoá", async () => {
    const detail = await crToReady("Log out of all devices");
    state().crs.get(detail.change_request.cr_id)!.change_request.status = "in_review";
    const base = `/projects/${P}/change-requests/${detail.change_request.cr_id}`;
    const groupPaths = detail.locations.filter((l) => l.group_id === "G01").map((l) => l.path);
    await call("POST", `${base}/groups/G01/decision`, { decision: "rejected", reason: "Ngoài phạm vi bản 1.0", base_version: state().spineVersion });
    // Group bị từ chối mở khoá ngay; vị trí not_related vẫn thuộc CR tới khi đóng
    expect(groupPaths.every((p) => !state().locks.has(p))).toBe(true);
    const closed = (await call<CrDetail>("POST", `${base}/close`, { reason: "Khách rút yêu cầu này" })).body.data!;
    expect(closed.change_request.status).toBe("rejected");
    expect(state().locks.size).toBe(0);

    const second = await crToReady("Log out of all devices v2");
    const cancelled = (await call<CrDetail>("POST", `/projects/${P}/change-requests/${second.change_request.cr_id}/cancel`, { reason: "Tạo nhầm change request" })).body.data!;
    expect(cancelled.change_request.status).toBe("cancelled");
    expect(state().locks.size).toBe(0);
    expect((await call("POST", `/projects/${P}/change-requests/${second.change_request.cr_id}/cancel`, { reason: "Huỷ lần hai nữa" })).body.error?.code).toBe("CR_INVALID_TRANSITION");
  });

  it("hết credit lúc đề xuất ⇒ paused; resume chạy tiếp", async () => {
    const { cr_id } = (await createCr("Log out of all devices")).change_request;
    const base = `/projects/${P}/change-requests/${cr_id}`;
    await call("POST", `${base}/clarify`, {});
    await call("POST", `${base}/impact`, {});
    state().credits = 0;
    const paused = (await call<CrDetail>("POST", `${base}/propose`, {})).body.data!;
    expect(paused.change_request.paused?.reason).toBe("credits");
    state().credits = 50;
    const resumed = (await call<CrDetail>("POST", `${base}/resume`, {})).body.data!;
    expect(resumed.change_request.paused).toBeNull();
    expect(resumed.locations.every((l) => l.conclusion !== null)).toBe(true);
  });

  it("G9: /changes, /undo, chat lệnh sửa ở project mode 1 ⇒ 409 CHANGE_REQUIRES_CR kèm prefill; mode 2 không bị chặn", async () => {
    const changes = await call("POST", `/projects/${P}/changes`, { base_version: 1, instruction: "Rename Learner to Student" });
    expect(changes.body.error?.code).toBe("CHANGE_REQUIRES_CR");
    expect(changes.body.meta?.prefill).toMatchObject({ description: "Rename Learner to Student" });
    expect((await call("POST", `/projects/${P}/undo`, { base_version: 1 })).body.error?.code).toBe("CHANGE_REQUIRES_CR");
    const chat = await call("POST", `/projects/${P}/chats/x/messages/stream`, { content: "Đổi tên actor Learner thành Student" });
    expect(chat.body.error?.code).toBe("CHANGE_REQUIRES_CR");
    const pipeline = await call("POST", `/projects/${MOCK_PROJECT_ID}/undo`, { base_version: 1 });
    expect(pipeline.body.error?.code).not.toBe("CHANGE_REQUIRES_CR");
  });
});

describe("mock mode 1 — release (#31)", () => {
  it("còn cờ đỏ ⇒ RELEASE_RED_FLAGS_OPEN; hết cờ đỏ ⇒ 1.0 sạch gom CR đã ghi", async () => {
    await importToGapReview();
    const detail = await crToReview("Log out of all devices");
    await call("POST", `/projects/${P}/change-requests/${detail.change_request.cr_id}/groups/G01/decision`, { decision: "approved", reason: "Đúng yêu cầu của khách", base_version: state().spineVersion });

    const blocked = await call("POST", `/projects/${P}/release`, { base_version: state().spineVersion });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error?.code).toBe("RELEASE_RED_FLAGS_OPEN");

    state().redFlags = 0;
    const rel = (await call<ReleaseResponse>("POST", `/projects/${P}/release`, { base_version: state().spineVersion })).body.data!;
    expect(rel.version).toMatchObject({ version: "1.0", kind: "release", has_clean_file: true, based_on: "0.2" });
    expect(rel.baseline.type).toBe("release");
    expect(rel.cr_ids).toEqual([detail.change_request.cr_id]);

    const versions = (await call<DocVersion[]>("GET", `/projects/${P}/versions`)).body.data!.map((v) => v.version);
    expect(versions).toEqual(["1.0", "0.2", "0.1"]);
    expect((await call("GET", `/projects/${P}/versions/1.0/download`)).headers.get("content-disposition")).toContain("_v1.0.docx");
    expect((await call("GET", `/projects/${P}/versions/9.9/blocks`)).body.error?.code).toBe("DOC_VERSION_NOT_FOUND");
  });
});
