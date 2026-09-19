// @vitest-environment node
// Môi trường node: FormData/Blob của jsdom làm mất tên file khi gửi multipart (tên thành "blob").
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import type { CrDetail } from "@/types/change-request";
import type { DocBlock, ExtractResponse, FinalizeResponse, GapReport, GetImportResponse, ImportStateResponse, ReuploadDiff } from "@/types/import";
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

/** Poll #4 như FE: tới khi rời `extracting` hoặc bị `paused` (I-4 chạy nền). */
const pollExtraction = async (): Promise<GetImportResponse> => {
  for (let i = 0; i < 50; i++) {
    const got = (await call<GetImportResponse>("GET", `/projects/${P}/import`)).body.data!;
    if (got.import?.status !== "extracting" || got.import.paused) return got;
  }
  throw new Error("I-4 không kết thúc sau 50 lần poll");
};

/** Đi từ upload tới gap_review, trả về import_id. */
const importToGapReview = async (): Promise<string> => {
  const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS_Lumen.docx"));
  const id = up.body.data!.import.id;
  await call("POST", `/projects/${P}/import/confirm-latest`, { import_id: id });
  await call("PATCH", `/projects/${P}/import/mapping`, { import_id: id, confirm_all: true });
  await call("POST", `/projects/${P}/import/extract`, { import_id: id });
  await pollExtraction();
  await call("PATCH", `/projects/${P}/import/fields`, { import_id: id, confirm_all: true });
  await call("POST", `/projects/${P}/import/finalize`, { import_id: id, base_version: state().spineVersion });
  return id;
};

const createCr = async (title: string, description = "Logging out must sign the user out of all devices.") =>
  (await call<CrDetail>("POST", `/projects/${P}/change-requests`, { title, description, source: { kind: "stakeholder_email" }, requester: "PM Lan" })).body.data!;

/** CR từ draft tới in_review. */
const crToReview = async (title: string): Promise<CrDetail> => {
  const { cr_id } = (await createCr(title)).change_request;
  const base = `/projects/${P}/change-requests/${cr_id}`;
  for (const step of ["clarify", "impact", "propose", "verify", "submit"]) {
    const res = await call<CrDetail>("POST", `${base}/${step}`, {});
    expect(res.status, `${step}: ${JSON.stringify(res.body.error)}`).toBe(200);
  }
  return (await call<CrDetail>("GET", base)).body.data!;
};

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("mock mode 1 — project theo mode (#1)", () => {
  it("tạo project import; customer_template ⇒ 501; mode lạ ⇒ 400", async () => {
    const created = await call<Project>("POST", "/projects", { name: "Lumen", mode: "import" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ mode: "import", import_state: null });
    expect((await call("POST", "/projects", { name: "X", mode: "customer_template" })).body.error?.code).toBe("NOT_IMPLEMENTED");
    expect((await call("POST", "/projects", { name: "X", mode: "coaching" })).status).toBe(400);
    expect((await call<Project>("POST", "/projects", { name: "Y" })).body.data?.mode).toBe("fpt");
  });

  it("GET project mode 1 trả mode import; project mode 2 vẫn do mock pipeline trả", async () => {
    expect((await call<Project>("GET", `/projects/${P}`)).body.data?.mode).toBe("import");
    expect((await call<Project>("GET", `/projects/${MOCK_PROJECT_ID}`)).body.data?.mode).toBe("fpt");
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

  it("đi trọn upload → xác nhận → mapping → trích → field → finalize → gap report", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS_Lumen.docx"));
    expect(up.status).toBe(201);
    const id = up.body.data!.import.id;
    expect(up.body.data!.import.status).toBe("awaiting_latest_confirm");

    expect((await call("PATCH", `/projects/${P}/import/mapping`, { import_id: id, confirm_all: true })).body.error?.code).toBe("IMPORT_NEEDS_LATEST_CONFIRM");
    expect((await call<ImportStateResponse>("POST", `/projects/${P}/import/confirm-latest`, { import_id: id })).body.data!.import.status).toBe("mapping_review");

    const got = (await call<GetImportResponse>("GET", `/projects/${P}/import`)).body.data!;
    expect(got.blocks_count).toBe(12);
    expect(got.profile!.heading_map.some((h) => h.confidence < 0.8)).toBe(true);
    expect(got.profile!.heading_map.some((h) => h.section_id === "unmapped")).toBe(true);

    expect((await call<ImportStateResponse>("PATCH", `/projects/${P}/import/mapping`, { import_id: id, confirm_all: true })).body.data!.import.status).toBe("extracting");
    const extracted = await call<ExtractResponse>("POST", `/projects/${P}/import/extract`, { import_id: id });
    // #6 trả ngay: vẫn extracting, chưa section nào xong — tiến độ xem qua poll #4
    expect(extracted.body.data!.import).toMatchObject({ status: "extracting", paused: null });
    expect(extracted.body.data!.sections.every((s) => s.status === "pending")).toBe(true);
    const polled = await pollExtraction();
    expect(polled.import!.status).toBe("fields_review");
    expect(polled.extraction.review_fields).toHaveLength(1);

    expect((await call<ImportStateResponse>("PATCH", `/projects/${P}/import/fields`, { import_id: id, confirm_all: true })).body.data!.import.status).toBe("baselining");
    expect((await call("POST", `/projects/${P}/import/finalize`, { import_id: id, base_version: 99 })).body.error?.code).toBe("SPINE_VERSION_CONFLICT");

    const fin = await call<FinalizeResponse>("POST", `/projects/${P}/import/finalize`, { import_id: id, base_version: state().spineVersion });
    expect(fin.body.data).toMatchObject({ doc_version: "0.0", baseline: { type: "imported", doc_version: "0.0" }, import: { status: "gap_review" } });
    expect((await call<Project>("GET", `/projects/${P}`)).body.data?.import_state).toBe("gap_review");

    const report = (await call<GapReport>("GET", `/projects/${P}/gap-report`)).body.data!;
    expect(report.totals.red).toBe(1);
    expect(report.missing_sections[0].section_id).toBe("fixed:5.3");
    const docx = await call("GET", `/projects/${P}/gap-report?format=docx`);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("hết credit giữa lúc trích ⇒ paused + cursor; resume không trích lại section đã xong", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS.docx"));
    const id = up.body.data!.import.id;
    await call("POST", `/projects/${P}/import/confirm-latest`, { import_id: id });
    await call("PATCH", `/projects/${P}/import/mapping`, { import_id: id, confirm_all: true });
    state().credits = 4; // đủ 2 section
    expect((await call<ExtractResponse>("POST", `/projects/${P}/import/extract`, { import_id: id })).body.data!.import.paused).toBeNull();
    const paused = await pollExtraction();
    expect(paused.import!.paused?.reason).toBe("credits");
    const sections = paused.extraction.sections;
    expect(paused.import!.extract_cursor).toBe(sections[2].section_id);
    expect(sections.filter((s) => s.status === "done")).toHaveLength(2);

    state().credits = 100;
    const resumed = (await call<ExtractResponse>("POST", `/projects/${P}/import/resume`, { import_id: id })).body.data!;
    expect(resumed.import).toMatchObject({ status: "extracting", paused: null });
    const done = await pollExtraction();
    expect(done.import!.paused).toBeNull();
    expect(done.extraction.sections.every((s) => s.status === "done")).toBe(true);
    expect(state().credits).toBe(100 - 2 * (sections.length - 2));
  });

  it("gọi #6 hai lần khi job đang chạy không bật job thứ hai, không trích lại", async () => {
    const up = await call<ImportStateResponse>("POST", `/projects/${P}/import`, upload("SRS.docx"));
    const id = up.body.data!.import.id;
    await call("POST", `/projects/${P}/import/confirm-latest`, { import_id: id });
    await call("PATCH", `/projects/${P}/import/mapping`, { import_id: id, confirm_all: true });
    await call("POST", `/projects/${P}/import/extract`, { import_id: id });
    await call("GET", `/projects/${P}/import`);
    await call("POST", `/projects/${P}/import/extract`, { import_id: id });
    const done = await pollExtraction();
    expect(state().credits).toBe(100 - 2 * done.extraction.sections.length);
  });

  it("đã có baseline thì /import từ chối, /reupload trả diff và không tạo version", async () => {
    await importToGapReview();
    expect((await call("POST", `/projects/${P}/import`, upload("SRS_v2.docx"))).body.error?.code).toBe("IMPORT_INVALID_STATE");
    const diff = await call<ReuploadDiff>("POST", `/projects/${P}/reupload`, upload("SRS_v0.0_sua.docx"));
    expect(diff.status).toBe(201);
    expect(diff.body.data).toMatchObject({ against_version: "0.0", summary: { added: 1, modified: 1 } });
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

  it("đi trọn CR: khoá block, CR thứ hai chạm cùng block ⇒ BLOCK_LOCKED; duyệt ⇒ 0.1 có Track Changes, mở khoá", async () => {
    const detail = await crToReview("Log out of all devices");
    expect(detail.change_request.status).toBe("in_review");
    const locked = detail.locations.map((l) => l.block_id);
    expect(locked.length).toBeGreaterThan(0);
    expect(detail.locations.every((l) => l.block?.locked_by_cr === detail.change_request.cr_id)).toBe(true);

    const other = (await createCr("Log out of all devices again")).change_request.cr_id;
    await call("POST", `/projects/${P}/change-requests/${other}/clarify`, {});
    const conflict = await call("POST", `/projects/${P}/change-requests/${other}/impact`, {});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("BLOCK_LOCKED");
    expect(conflict.body.meta?.locked).toEqual(expect.arrayContaining([expect.objectContaining({ cr_id: detail.change_request.cr_id })]));

    const base = `/projects/${P}/change-requests/${detail.change_request.cr_id}`;
    expect((await call("POST", `${base}/groups/G01/decision`, { decision: "rejected", reason: "ngắn", base_version: state().spineVersion })).status).toBe(400);
    const written = (await call<CrDetail>("POST", `${base}/groups/G01/decision`, { decision: "approved", base_version: state().spineVersion })).body.data!;
    expect(written.change_request).toMatchObject({ status: "written", result_doc_version: "0.1" });

    const blocks = (await call<DocBlock[]>("GET", `/projects/${P}/versions/0.1/blocks`)).body.data!;
    expect(blocks.some((b) => b.revisions?.some((r) => r.author === detail.change_request.cr_id && r.kind === "ins"))).toBe(true);
    expect(blocks.every((b) => b.locked_by_cr === null)).toBe(true);

    const cmp = (await call<CompareResponse>("GET", `/projects/${P}/versions/compare?from=0.0&to=0.1`)).body.data!;
    expect(cmp.summary.modified).toBeGreaterThan(0);
    const dl = await call("GET", `/projects/${P}/versions/0.1/download`);
    expect(dl.headers.get("content-disposition")).toContain("_v0.1_DRAFT.docx");
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
    const fixed = await call<CrDetail>("PATCH", `${base}/locations/L001`, { conclusion: "edit", new_text: "3.2.4 Sign out of all devices" });
    expect(fixed.body.data!.locations[0].manual).toBe(true);
    expect((await call<CrDetail>("POST", `${base}/verify`, {})).body.data!.change_request.status).toBe("ready_to_submit");
  });

  it("mọi group bị từ chối ⇒ đóng (rejected) và mở khoá; huỷ CR khác cũng mở khoá", async () => {
    const detail = await crToReview("Log out of all devices");
    const base = `/projects/${P}/change-requests/${detail.change_request.cr_id}`;
    const groupBlocks = detail.locations.filter((l) => l.group_id === "G01").map((l) => l.block_id);
    await call("POST", `${base}/groups/G01/decision`, { decision: "rejected", reason: "Ngoài phạm vi bản 1.0", base_version: state().spineVersion });
    const afterReject = (await call<DocBlock[]>("GET", `/projects/${P}/versions/0.0/blocks`)).body.data!;
    // Group bị từ chối mở khoá ngay; vị trí not_related vẫn thuộc CR tới khi đóng
    expect(afterReject.filter((b) => groupBlocks.includes(b.block_id)).every((b) => b.locked_by_cr === null)).toBe(true);
    const closed = (await call<CrDetail>("POST", `${base}/close`, { reason: "Khách rút yêu cầu này" })).body.data!;
    expect(closed.change_request.status).toBe("rejected");
    expect((await call<DocBlock[]>("GET", `/projects/${P}/versions/0.0/blocks`)).body.data!.every((b) => b.locked_by_cr === null)).toBe(true);

    const second = await crToReview("Log out of all devices v2");
    const cancelled = (await call<CrDetail>("POST", `/projects/${P}/change-requests/${second.change_request.cr_id}/cancel`, { reason: "Tạo nhầm change request" })).body.data!;
    expect(cancelled.change_request.status).toBe("cancelled");
    expect((await call<DocBlock[]>("GET", `/projects/${P}/versions/0.0/blocks`)).body.data!.every((b) => b.locked_by_cr === null)).toBe(true);
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
    await call("POST", `/projects/${P}/change-requests/${detail.change_request.cr_id}/groups/G01/decision`, { decision: "approved", base_version: state().spineVersion });

    const blocked = await call("POST", `/projects/${P}/release`, { base_version: state().spineVersion });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error?.code).toBe("RELEASE_RED_FLAGS_OPEN");

    state().redFlags = 0;
    const rel = (await call<ReleaseResponse>("POST", `/projects/${P}/release`, { base_version: state().spineVersion })).body.data!;
    expect(rel.version).toMatchObject({ version: "1.0", kind: "release", has_clean_file: true, based_on: "0.1" });
    expect(rel.baseline.type).toBe("release");
    expect(rel.cr_ids).toEqual([detail.change_request.cr_id]);

    const versions = (await call<DocVersion[]>("GET", `/projects/${P}/versions`)).body.data!.map((v) => v.version);
    expect(versions).toEqual(["1.0", "0.1", "0.0"]);
    expect((await call("GET", `/projects/${P}/versions/1.0/download`)).headers.get("content-disposition")).toContain("_v1.0.docx");
    expect((await call("GET", `/projects/${P}/versions/9.9/blocks`)).body.error?.code).toBe("DOC_VERSION_NOT_FOUND");
  });
});
