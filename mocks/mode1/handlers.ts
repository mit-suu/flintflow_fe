/**
 * msw handlers mode 1 theo `docs/api/import-change-contract.md` (FLF-171, P1 §5.8). Mọi route chỉ phục vụ
 * project `MODE1_PROJECT_ID`; project mode 2 của mock pipeline nhận `409 PROJECT_MODE_MISMATCH`.
 * Xếp TRƯỚC handlers pipeline: route trùng (`/changes`, `/undo`, chat…) chỉ chặn project mode 1, còn lại
 * trả `undefined` để msw chuyển sang handler pipeline.
 *
 * Quy ước mock để test/UI điều khiển được kịch bản:
 * - Tên file chứa `.doc` (không `x`) ⇒ LEGACY_DOC; chứa `tracked` ⇒ FOREIGN_TRACK_CHANGE; chứa `other-project` ⇒ stamp project khác.
 * - Mô tả CR chứa `mơ hồ` hoặc `ambiguous` ⇒ vòng làm rõ đầu hỏi lại.
 * - `new_text` chứa `FAIL` ⇒ verify trượt (AI làm lại ≤ 2 lần rồi `manual_fix`).
 * - `mode1State.credits` < giá lượt gọi ⇒ `paused: credits`; `mode1State.redFlags` > 0 ⇒ release bị chặn.
 */
import { http, HttpResponse, type DefaultBodyType, type PathParams, type StrictRequest } from "msw";
import { API_BASE_URL } from "@/lib/api/client";
import type { Project, ProjectMode } from "@/types/project";
import type { Baseline, Flag } from "@/types/spine";
import type { DocBlock, ExtractionSection, ImportedDocument, ImportStatus, ReviewField } from "@/types/import";
import type { DocVersion } from "@/types/doc-version";
import type { Cr, CrDetail, CrLocation, CrStatus } from "@/types/change-request";
import { CR_TERMINAL_STATUSES, DECISION_REASON_MIN_LENGTH, MAX_CLARIFY_ROUNDS, MAX_REDO_PER_LOCATION } from "@/types/change-request";
import { compareDocVersions, isReleaseVersion } from "@/types/doc-version";
import { MODE1_PROJECT_ID, MODE1_USER_ID, initialBlocks } from "./state";
import * as stateModule from "./state";

const api = (path: string) => `${API_BASE_URL}${path}`;
const now = () => new Date().toISOString();
/** Đọc biến live của module — `resetMode1MockState()` thay cả object. */
const S = () => stateModule.mode1State;

const ok = <T>(data: T, status = 200) => HttpResponse.json({ data, error: null }, { status });
const fail = (status: number, code: string, message: string, meta?: Record<string, unknown>) =>
  HttpResponse.json({ data: null, error: { code, message }, ...(meta ? { meta } : {}) }, { status });

const COST = { extract: 2, semantic: 3, clarify: 1, propose: 3, consistency: 2 } as const;

const spend = (cost: number): boolean => {
  if (S().credits < cost) return false;
  S().credits -= cost;
  return true;
};

const isMode1 = (projectId: unknown) => projectId === MODE1_PROJECT_ID;
const modeMismatch = () => fail(409, "PROJECT_MODE_MISMATCH", "API này chỉ dùng cho project mode import", { mode: "fpt", expected: "import" });

type Handler = (args: { params: PathParams; request: StrictRequest<DefaultBodyType> }) => Response | Promise<Response>;
/** Bọc route mode 1: project khác ⇒ 409 PROJECT_MODE_MISMATCH. */
const mode1 = (fn: Handler): Handler => (args) => (isMode1(args.params.projectId) ? fn(args) : modeMismatch());

/** File từ multipart — không dùng `instanceof File` vì jsdom và undici là hai realm khác nhau. */
const asFile = (value: FormDataEntryValue | null): { name: string; size: number } | null =>
  value && typeof value === "object" && "name" in value && "size" in value ? { name: String(value.name), size: Number(value.size) } : null;

const readJson = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    return ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
};

// ─── version helpers (cùng luật versioning.ts BE) ────────────────

const nextMinor = (v: string) => {
  const [a, b] = v.split(".").map(Number);
  return `${a}.${b + 1}`;
};
const nextMajor = (v: string) => `${Number(v.split(".")[0]) + 1}.0`;
const latestVersion = (): string | null => S().versions.map((v) => v.version).sort(compareDocVersions).at(-1) ?? null;
const latestBlocks = (): DocBlock[] => S().blocks.get(latestVersion() ?? "") ?? [];

// ─── import ──────────────────────────────────────────────────────

const setImportStatus = (status: ImportStatus) => {
  const doc = S().importDoc!;
  doc.status = status;
  doc.updated_at = now();
  S().project.import_state = status;
};

const hasBaseline = () => S().baselines.length > 0;

const invalidImportState = (to: string) =>
  fail(409, "IMPORT_INVALID_STATE", `Không chuyển được import sang "${to}"`, { status: S().importDoc?.status ?? null, to });

const parseDocument = () => {
  const blocks = initialBlocks();
  S().blocks.set("0.0", blocks);
  S().profile = {
    doc_version: "0.0",
    language: "en",
    required_sections: ["fixed:5.3"],
    heading_map: blocks
      .filter((b) => b.kind === "heading")
      .map((b) => ({
        block_id: b.block_id,
        heading_text: b.text,
        section_id: b.section_id ?? "unmapped",
        confidence: b.section_id ? (b.block_id === "B0007" ? 0.62 : 0.93) : 0.3,
        detected_by: "numbering_pattern" as const,
        confirmed: false,
      })),
    table_map: [{ block_id: "B0005", column_index: 0, header: "Actor", field_path: "actors[].name", confidence: 0.88, confirmed: false }],
  };
};

const sectionIds = () => [...new Set((S().profile?.heading_map ?? []).map((h) => h.section_id).filter((id) => id !== "unmapped"))];

/**
 * I-4 chạy nền như BE (việc A sau P2): #6/#10 chỉ bật job rồi trả ngay `extracting` + `paused: null`;
 * mỗi lần poll #4 trích thêm **một** section từ `extract_cursor` để FE thấy tiến độ tăng dần.
 * Hết credit ⇒ job dừng, `paused: credits`; section đã `done` không trích lại.
 */
const startExtraction = () => {
  const doc = S().importDoc!;
  doc.paused = null;
  doc.extract_cursor = S().sections.find((s) => s.status !== "done")?.section_id ?? null;
  S().extractRunning = true;
};

const extractNextSection = () => {
  const doc = S().importDoc!;
  const section = S().sections.find((s) => s.status !== "done");
  if (section) {
    doc.extract_cursor = section.section_id;
    if (!spend(COST.extract)) {
      doc.paused = { reason: "credits", at: now() };
      S().extractRunning = false;
      return;
    }
    section.status = "done";
    section.fields_total = 3;
    if (section.section_id === "fixed:2.1") {
      section.fields_needing_review = 1;
      const field: ReviewField = {
        section_id: "fixed:2.1",
        path: "actors[id=A02].kind",
        value: "human",
        confidence: 0.55,
        source_block_ids: ["B0006"],
        origin: "ai",
        confirmed: false,
      };
      S().reviewFields.push(field);
    }
  }
  const next = S().sections.find((s) => s.status !== "done");
  if (next) {
    doc.extract_cursor = next.section_id;
    return;
  }
  doc.extract_cursor = null;
  S().extractRunning = false;
  setImportStatus(S().reviewFields.some((f) => !f.confirmed) ? "fields_review" : "baselining");
};

const redFlag = (): Flag => ({
  id: "FL001",
  level: "red",
  rule_id: "section_empty",
  section_id: "fixed:5.3",
  message: "Mục 5.3 Application Messages List bắt buộc nhưng tài liệu không có",
  remediation_step: "S-7.2",
  opened_at_version: S().spineVersion,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
});

const yellowFlag = (): Flag => ({ ...redFlag(), id: "FL002", level: "yellow", rule_id: "ambiguity", section_id: "fixed:4.2.3", message: "\"quickly\" không đo được — cần ngưỡng (vd ≤ 2 giây)" });

/** Cờ mở sau import: đỏ theo `redFlags` (0 ⇒ release được) + một cờ vàng. Chưa có baseline ⇒ chưa check. */
const openFlags = (): Flag[] => (hasBaseline() ? [...(S().redFlags > 0 ? [redFlag()] : []), yellowFlag()] : []);

const newBaseline =(type: Baseline["type"], version: string): Baseline => ({
  id: `BL${String(S().baselines.length + 1).padStart(3, "0")}`,
  version,
  type,
  doc_version: version,
  at: now(),
  snapshot_ref: `6600000000000000000000${String(S().baselines.length + 1).padStart(2, "0")}`,
  checked_at_version: S().spineVersion,
  waived_count: 0,
});

const addVersion = (version: Omit<DocVersion, "created_by" | "created_at">): DocVersion => {
  const v: DocVersion = { ...version, created_by: MODE1_USER_ID, created_at: now() };
  S().versions.push(v);
  return v;
};

const versionConflict = (baseVersion: unknown) =>
  baseVersion !== S().spineVersion
    ? fail(409, "SPINE_VERSION_CONFLICT", "Tài liệu vừa được thay đổi ở phiên khác. Vui lòng tải lại rồi thử lại.", { spine_version: S().spineVersion })
    : null;

const docxFile = (name: string) =>
  new HttpResponse("mock docx bytes (mode 1)", {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });

// ─── change request ──────────────────────────────────────────────

const crOr404 = (crId: unknown): CrDetail | Response =>
  S().crs.get(String(crId)) ?? fail(404, "CR_NOT_FOUND", `Không có change request ${String(crId)}`);

const invalidTransition = (cr: Cr, to: CrStatus) =>
  fail(409, "CR_INVALID_TRANSITION", `Không chuyển được change request từ "${cr.status}" sang "${to}"`, { status: cr.status, to });

const setCrStatus = (detail: CrDetail, status: CrStatus) => {
  detail.change_request.status = status;
  detail.change_request.updated_at = now();
};

const unlock = (crId: string, blockIds?: string[]) => {
  for (const b of latestBlocks()) if (b.locked_by_cr === crId && (!blockIds || blockIds.includes(b.block_id))) b.locked_by_cr = null;
};

/** Khoá nguyên tử: một block đã bị CR khác giữ ⇒ không khoá gì, trả danh sách xung đột. */
const lock = (crId: string, blockIds: string[]): { block_id: string; cr_id: string }[] => {
  const blocks = latestBlocks().filter((b) => blockIds.includes(b.block_id));
  const conflicts = blocks.filter((b) => b.locked_by_cr && b.locked_by_cr !== crId).map((b) => ({ block_id: b.block_id, cr_id: b.locked_by_cr! }));
  if (conflicts.length === 0) for (const b of blocks) b.locked_by_cr = crId;
  return conflicts;
};

const withBlocks = (detail: CrDetail): CrDetail => ({
  ...detail,
  locations: detail.locations.map((l) => ({ ...l, block: latestBlocks().find((b) => b.block_id === l.block_id) ?? null })),
});

const okCr = (detail: CrDetail, status = 200) => ok(withBlocks(detail), status);

const runClarify = (detail: CrDetail) => {
  const cr = detail.change_request;
  detail.change_request.paused = null;
  if (!spend(COST.clarify)) {
    cr.paused = { reason: "credits", at: now() };
    return;
  }
  const round = cr.clarifications.length;
  const vague = /mơ hồ|ambiguous/i.test(cr.description);
  if (vague && round < MAX_CLARIFY_ROUNDS - 1 && cr.clarifications.every((c) => c.answers.length === 0)) {
    cr.clarifications.push({ round: round + 1, questions: ["Thay đổi áp cho cả ứng dụng mobile không?", "Có cần thông báo cho các phiên bị đăng xuất không?"], answers: [] });
    detail.pending_questions = cr.clarifications.at(-1)!.questions;
    setCrStatus(detail, "awaiting_answers");
    return;
  }
  detail.pending_questions = [];
  setCrStatus(detail, "impact_review");
};

const keywordsOf = (cr: Cr) =>
  `${cr.title} ${cr.description}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length > 3);

const runPropose = (detail: CrDetail) => {
  const cr = detail.change_request;
  // Bước bắt đầu ⇒ đã ở proposing, kể cả khi pause ngay vì hết credit (resume chạy tiếp từ đây)
  setCrStatus(detail, "proposing");
  cr.paused = null;
  if (!spend(COST.propose)) {
    cr.paused = { reason: "credits", at: now() };
    return;
  }
  detail.locations.forEach((loc, i) => {
    if (loc.manual) return;
    const text = latestBlocks().find((b) => b.block_id === loc.block_id)?.text ?? "";
    if (i === 0) {
      loc.conclusion = "edit";
      loc.reason = `Vị trí chính của ${cr.cr_id}`;
      loc.proposal = { old_text: text, new_text: `${text} (${cr.title})`, comment_text: null, spine_ops: [] };
    } else {
      loc.conclusion = "not_related";
      loc.reason = "Chỉ trùng từ khoá, không nói về thay đổi này";
      loc.proposal = { old_text: text, new_text: null, comment_text: null, spine_ops: [] };
    }
  });
  regroup(detail);
  setCrStatus(detail, "proposing");
};

const regroup = (detail: CrDetail) => {
  const affected = detail.locations.filter((l) => l.conclusion === "edit" || l.conclusion === "comment");
  detail.groups = affected.map((l, i) => ({
    group_id: `G${String(i + 1).padStart(2, "0")}`,
    title: l.block?.text ?? latestBlocks().find((b) => b.block_id === l.block_id)?.text ?? l.block_id,
    location_ids: [l.location_id],
    decision: "pending",
    reason: null,
    decided_by: null,
    decided_at: null,
  }));
  for (const l of detail.locations) l.group_id = detail.groups.find((g) => g.location_ids.includes(l.location_id))?.group_id ?? null;
};

const runVerify = (detail: CrDetail) => {
  const cr = detail.change_request;
  cr.paused = null;
  if (!spend(COST.consistency)) {
    cr.paused = { reason: "credits", at: now() };
    return;
  }
  let failed: CrLocation | null = null;
  for (const loc of detail.locations) {
    const bad = loc.conclusion === "edit" && (loc.proposal?.new_text ?? "").includes("FAIL");
    loc.verify = {
      code_ok: !bad,
      violations: bad ? [{ rule: "invariant_3_dead_reference", message: "Đề xuất làm hỏng tham chiếu" }] : [],
      ai_flags: [],
      at: now(),
    };
    if (bad) failed = loc;
  }
  if (!failed) return setCrStatus(detail, "ready_to_submit");
  if (failed.redo_count < MAX_REDO_PER_LOCATION && !failed.manual) {
    failed.redo_count += 1;
    return setCrStatus(detail, "proposing");
  }
  setCrStatus(detail, "manual_fix");
};

/** C-7: ghi Track Changes (mock: text mới + revisions), version minor mới, mở khoá hết. */
const writeCr = (detail: CrDetail) => {
  const cr = detail.change_request;
  const from = latestVersion()!;
  const to = nextMinor(from);
  const approved = new Set(detail.groups.filter((g) => g.decision === "approved").flatMap((g) => g.location_ids));
  const edits = new Map(detail.locations.filter((l) => approved.has(l.location_id) && l.conclusion === "edit").map((l) => [l.block_id, l]));
  const blocks = latestBlocks().map((b): DocBlock => {
    const loc = edits.get(b.block_id);
    const base: DocBlock = { ...b, doc_version: to, locked_by_cr: null, revisions: undefined };
    if (!loc?.proposal?.new_text) return base;
    return {
      ...base,
      text: loc.proposal.new_text,
      revisions: [
        { kind: "del", text: loc.proposal.old_text, author: cr.cr_id },
        { kind: "ins", text: loc.proposal.new_text, author: cr.cr_id },
      ],
    };
  });
  S().blocks.set(to, blocks);
  unlock(cr.cr_id);
  addVersion({ version: to, kind: "cr_revision", based_on: from, cr_ids: [cr.cr_id], baseline_id: null, has_clean_file: false });
  S().spineVersion += 1;
  cr.result_doc_version = to;
  cr.decided_by = MODE1_USER_ID;
  setCrStatus(detail, "written");
};

const CHANGE_VERB = /^\s*(đổi|sửa|thêm|xoá|xóa|bỏ|rename|change|add|remove|delete|update)\b/i;
const requiresCr = (instruction: string) =>
  fail(409, "CHANGE_REQUIRES_CR", "Tài liệu đã có baseline — mọi sửa phải qua change request", {
    prefill: { title: instruction.slice(0, 80) || "Change request", description: instruction },
  });

// ─── handlers ────────────────────────────────────────────────────

export const mode1Handlers = [
  // #1 Project theo mode
  http.post(api("/projects"), async ({ request }) => {
    const body = await readJson(request);
    const mode = (body.mode ?? "fpt") as ProjectMode;
    if (!["import", "fpt", "customer_template"].includes(mode)) return fail(400, "VALIDATION_ERROR", "mode phải là import, fpt hoặc customer_template");
    if (!body.name) return fail(400, "NAME_REQUIRED", "Project name is required");
    if (mode === "customer_template") return fail(501, "NOT_IMPLEMENTED", "Mode template khách hàng chưa hỗ trợ");
    const project: Project = {
      _id: `6500000000000000000001${String(S().created.length).padStart(2, "0")}`,
      name: String(body.name),
      domain: (body.domain as string | undefined) ?? null,
      status: "active",
      mode,
      import_state: null,
      createdAt: now(),
      updatedAt: now(),
    };
    S().created.push(project);
    return ok(project, 201);
  }),
  http.get(api("/projects/:projectId"), ({ params }) => {
    if (isMode1(params.projectId)) return ok(S().project);
    const created = S().created.find((p) => p._id === params.projectId);
    return created ? ok(created) : undefined;
  }),

  // #2 Upload + preflight
  http.post(
    api("/projects/:projectId/import"),
    mode1(async ({ request }) => {
      if (hasBaseline()) return fail(409, "IMPORT_INVALID_STATE", "Đã có baseline — dùng POST /reupload để so bản mới", { status: S().importDoc?.status });
      const form = await request.formData();
      const file = asFile(form.get("file"));
      if (!file) return fail(400, "VALIDATION_ERROR", "Thiếu field file (.docx)");
      const name = file.name;
      if (/other-project/i.test(name)) {
        return fail(422, "IMPORT_STAMP_FOREIGN_PROJECT", "File này thuộc project khác", { stamp: { project_id: "650000000000000000000099", version: "0.3", source: "cr_revision" } });
      }
      const issues =
        /\.doc$/i.test(name)
          ? [{ code: "LEGACY_DOC" as const, message: "File .doc (Word 97-2003), hãy lưu lại dạng .docx" }]
          : /tracked/i.test(name)
            ? [{ code: "FOREIGN_TRACK_CHANGE" as const, message: "Track Changes (ins) của \"Nguyen Van A\" chưa được Accept/Reject", location: { block_ord: 5, text: "3.2.5 Create SRS project" } }]
            : file.size > 10 * 1024 * 1024
              ? [{ code: "FILE_TOO_LARGE" as const, message: "File lớn hơn 10MB" }]
              : [];
      const doc: ImportedDocument = {
        id: `66f0000000000000000000${String(S().versions.length + 10)}`,
        project_id: MODE1_PROJECT_ID,
        original_name: name,
        size: file.size,
        sha256: "a".repeat(64),
        status: issues.length ? "preflight_rejected" : "awaiting_latest_confirm",
        preflight: { status: issues.length ? "rejected" : "accepted", issues },
        stamp: null,
        confirmed_latest_at: null,
        paused: null,
        extract_cursor: null,
        created_at: now(),
        updated_at: now(),
      };
      S().importDoc = doc;
      S().project.import_state = doc.status;
      if (issues.length) return fail(422, "IMPORT_FILE_REJECTED", "File chưa nhập được", { import_id: doc.id, issues });
      return ok({ import: doc }, 201);
    }),
  ),

  // #3 Xác nhận bản mới nhất ⇒ parse ⇒ mapping_review
  http.post(
    api("/projects/:projectId/import/confirm-latest"),
    mode1(() => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (doc.status !== "awaiting_latest_confirm") return invalidImportState("parsing");
      doc.confirmed_latest_at = now();
      parseDocument();
      setImportStatus("mapping_review");
      return ok({ import: doc });
    }),
  ),

  // #4 Trạng thái import
  http.get(
    api("/projects/:projectId/import"),
    mode1(() => {
      if (S().extractRunning) extractNextSection();
      return ok({
        import: S().importDoc,
        profile: S().profile,
        extraction: { sections: S().sections, review_fields: S().reviewFields.filter((f) => !f.confirmed) },
        blocks_count: S().blocks.get("0.0")?.length ?? 0,
      });
    }),
  ),

  // #5 Xác nhận mapping
  http.patch(
    api("/projects/:projectId/import/mapping"),
    mode1(async ({ request }) => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (doc.status === "awaiting_latest_confirm") return fail(409, "IMPORT_NEEDS_LATEST_CONFIRM", "Xác nhận đây là bản mới nhất trước", { import_id: doc.id });
      if (doc.status !== "mapping_review") return invalidImportState("extracting");
      const body = await readJson(request);
      const headings = (body.headings as { block_id: string; section_id: string }[] | undefined) ?? [];
      if (!headings.length && !body.confirm_all && !(body.tables as unknown[] | undefined)?.length) {
        return fail(400, "VALIDATION_ERROR", "Cần ít nhất một mục mapping hoặc confirm_all");
      }
      for (const h of headings) {
        const entry = S().profile!.heading_map.find((e) => e.block_id === h.block_id);
        if (entry) Object.assign(entry, { section_id: h.section_id, confirmed: true, detected_by: "user" });
      }
      if (body.confirm_all) for (const e of S().profile!.heading_map) e.confirmed = true;
      if (S().profile!.heading_map.every((e) => e.confirmed)) {
        S().sections = sectionIds().map((section_id): ExtractionSection => ({ section_id, status: "pending", fields_total: 0, fields_needing_review: 0, error: null }));
        setImportStatus("extracting");
      }
      return ok({ import: doc });
    }),
  ),

  // #6 Trích field (I-4) — trả ngay, job chạy nền; FE poll #4
  http.post(
    api("/projects/:projectId/import/extract"),
    mode1(() => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (doc.status !== "extracting") return invalidImportState("extracting");
      if (!S().extractRunning) startExtraction();
      return ok({ import: doc, sections: S().sections });
    }),
  ),

  // #7 Xác nhận field độ tin thấp
  http.patch(
    api("/projects/:projectId/import/fields"),
    mode1(async ({ request }) => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (doc.status !== "fields_review") return invalidImportState("baselining");
      const body = await readJson(request);
      const fields = (body.fields as { path: string; confirmed: boolean; edited_value?: unknown }[] | undefined) ?? [];
      if (!fields.length && !body.confirm_all) return fail(400, "VALIDATION_ERROR", "Cần ít nhất một field hoặc confirm_all");
      for (const f of fields) {
        const target = S().reviewFields.find((r) => r.path === f.path);
        if (target) Object.assign(target, { confirmed: true, ...(f.edited_value !== undefined ? { edited_value: f.edited_value } : {}) });
      }
      if (body.confirm_all) for (const r of S().reviewFields) r.confirmed = true;
      if (S().reviewFields.every((r) => r.confirmed)) setImportStatus("baselining");
      return ok({ import: doc });
    }),
  ),

  // #8 Finalize ⇒ baseline v0 + check ⇒ gap_review
  http.post(
    api("/projects/:projectId/import/finalize"),
    mode1(async ({ request }) => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (doc.status !== "baselining") return invalidImportState("checking");
      const body = await readJson(request);
      const conflict = versionConflict(body.base_version);
      if (conflict) return conflict;
      if (!spend(COST.semantic)) return fail(402, "INSUFFICIENT_CREDIT", "Không đủ credit cho bước kiểm ngữ nghĩa", { required: COST.semantic, balance: S().credits });
      S().spineVersion += 1;
      const baseline = newBaseline("imported", "0.0");
      S().baselines.push(baseline);
      addVersion({ version: "0.0", kind: "imported", based_on: null, cr_ids: [], baseline_id: baseline.id, has_clean_file: false });
      setImportStatus("checking");
      setImportStatus("gap_review");
      return ok({ import: doc, doc_version: "0.0", baseline, spine_version: S().spineVersion, flags: { red: S().redFlags, yellow: 1 } });
    }),
  ),

  // #9 Gap report
  http.get(
    api("/projects/:projectId/gap-report"),
    mode1(({ request }) => {
      const doc = S().importDoc;
      if (!doc || !["gap_review", "delivered", "change_requested"].includes(doc.status)) return invalidImportState("gap_review");
      if (new URL(request.url).searchParams.get("format") === "docx") return docxFile(`${S().project.name}_gap-report.docx`);
      const flags = [...(S().redFlags > 0 ? [redFlag()] : []), yellowFlag()];
      return ok({
        project_id: MODE1_PROJECT_ID,
        doc_version: "0.0",
        generated_at: now(),
        totals: { red: S().redFlags, yellow: 1, missing_sections: 1, unmapped_headings: 1, low_confidence_fields: 0 },
        sections: [...new Set(flags.map((f) => f.section_id))].map((section_id) => ({ section_id, title: section_id, flags: flags.filter((f) => f.section_id === section_id) })),
        missing_sections: [{ section_id: "fixed:5.3", title: "Application Messages List" }],
        unmapped_headings: [{ block_id: "B0011", text: "Phụ lục B — Biên bản họp" }],
        low_confidence_fields: [],
      });
    }),
  ),

  // #10 Resume import sau pause — ở extracting: trả ngay, chạy nền như #6
  http.post(
    api("/projects/:projectId/import/resume"),
    mode1(() => {
      const doc = S().importDoc;
      if (!doc) return fail(404, "IMPORT_NOT_FOUND", "Chưa upload file");
      if (!doc.paused || doc.status !== "extracting") return invalidImportState("extracting");
      startExtraction();
      return ok({ import: doc, sections: S().sections });
    }),
  ),

  // #11 Re-upload ⇒ diff, không tạo version
  http.post(
    api("/projects/:projectId/reupload"),
    mode1(async ({ request }) => {
      if (!hasBaseline()) return fail(409, "IMPORT_INVALID_STATE", "Chưa có baseline — dùng POST /import", { status: S().importDoc?.status ?? null });
      const form = await request.formData();
      const file = asFile(form.get("file"));
      if (!file) return fail(400, "VALIDATION_ERROR", "Thiếu field file (.docx)");
      if (/other-project/i.test(file.name)) {
        return fail(422, "IMPORT_STAMP_FOREIGN_PROJECT", "File này thuộc project khác", { stamp: { project_id: "650000000000000000000099", version: "0.3", source: "cr_revision" } });
      }
      const diff = {
        id: `66f00000000000000000r${String(S().reuploads.length + 1).padStart(3, "0")}`,
        original_name: file.name,
        against_version: latestVersion()!,
        created_at: now(),
        summary: { added: 1, removed: 0, modified: 1, moved: 0 },
        blocks: [
          { block_id: "B0010", change: "modified" as const, before: "NFR-P02: The system responds quickly under load.", after: "NFR-P02: 95% of requests respond within 2 seconds." },
          { block_id: null, change: "added" as const, after: "NFR-P03: The system supports 500 concurrent learners." },
        ],
      };
      S().reuploads.push(diff);
      return ok(diff, 201);
    }),
  ),

  // #12–#15 Version
  http.get(api("/projects/:projectId/versions"), mode1(() => ok([...S().versions].sort((a, b) => compareDocVersions(b.version, a.version))))),
  http.get(
    api("/projects/:projectId/versions/compare"),
    mode1(({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      if (!from || !to || from === to) return fail(400, "VALIDATION_ERROR", "Cần from và to khác nhau");
      const a = S().blocks.get(from);
      const b = S().blocks.get(to);
      if (!a || !b) return fail(404, "DOC_VERSION_NOT_FOUND", `Không có version ${!a ? from : to}`);
      const blocks = b
        .filter((x) => a.find((y) => y.block_id === x.block_id)?.text !== x.text)
        .map((x) => ({ block_id: x.block_id, change: "modified" as const, before: a.find((y) => y.block_id === x.block_id)?.text, after: x.text }));
      return ok({ from, to, summary: { added: 0, removed: 0, modified: blocks.length, moved: 0 }, blocks });
    }),
  ),
  http.get(
    api("/projects/:projectId/versions/:v/blocks"),
    mode1(({ params }) => {
      const blocks = S().blocks.get(String(params.v));
      return blocks ? ok(blocks) : fail(404, "DOC_VERSION_NOT_FOUND", `Không có version ${String(params.v)}`);
    }),
  ),
  http.get(
    api("/projects/:projectId/versions/:v/download"),
    mode1(({ params, request }) => {
      const v = String(params.v);
      if (!S().versions.some((x) => x.version === v)) return fail(404, "DOC_VERSION_NOT_FOUND", `Không có version ${v}`);
      const tracked = new URL(request.url).searchParams.get("variant") === "tracked";
      const draft = tracked || !isReleaseVersion(v);
      return docxFile(`${S().project.name}_v${v}${draft && !isReleaseVersion(v) ? "_DRAFT" : ""}.docx`);
    }),
  ),

  // #16–#18 Change request
  http.post(
    api("/projects/:projectId/change-requests"),
    mode1(async ({ request }) => {
      if (!hasBaseline()) return fail(409, "CR_REQUIRES_BASELINE", "Cần import xong (baseline v0) trước khi tạo change request");
      const body = await readJson(request);
      const source = body.source as { kind?: string; ref?: string | null; note?: string | null } | undefined;
      if (!source?.kind || !String(body.requester ?? "").trim()) return fail(400, "CR_SOURCE_REQUIRED", "Change request cần nguồn và người yêu cầu");
      if (!String(body.title ?? "").trim() || !String(body.description ?? "").trim()) return fail(400, "VALIDATION_ERROR", "Cần title và description");
      S().crSeq += 1;
      const cr: Cr = {
        cr_id: `CR-${String(S().crSeq).padStart(3, "0")}`,
        project_id: MODE1_PROJECT_ID,
        title: String(body.title),
        description: String(body.description),
        source: { kind: source.kind as Cr["source"]["kind"], ref: source.ref ?? null, note: source.note ?? null },
        requester: String(body.requester),
        status: "draft",
        paused: null,
        clarifications: [],
        base_doc_version: latestVersion()!,
        result_doc_version: null,
        created_by: MODE1_USER_ID,
        submitted_at: null,
        decided_by: null,
        closed_reason: null,
        created_at: now(),
        updated_at: now(),
      };
      const detail: CrDetail = { change_request: cr, locations: [], groups: [], pending_questions: [] };
      S().crs.set(cr.cr_id, detail);
      return okCr(detail, 201);
    }),
  ),
  http.get(
    api("/projects/:projectId/change-requests"),
    mode1(({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      const list = [...S().crs.values()].map((d) => d.change_request).filter((c) => !status || c.status === status);
      return ok(list.reverse());
    }),
  ),
  http.get(
    api("/projects/:projectId/change-requests/:crId"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      return d instanceof Response ? d : okCr(d);
    }),
  ),

  // #19 Làm rõ (C-2)
  http.post(
    api("/projects/:projectId/change-requests/:crId/clarify"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      if (d.change_request.status !== "draft" && d.change_request.status !== "clarifying") return invalidTransition(d.change_request, "clarifying");
      setCrStatus(d, "clarifying");
      runClarify(d);
      return okCr(d);
    }),
  ),

  // #20 Trả lời làm rõ
  http.post(
    api("/projects/:projectId/change-requests/:crId/answers"),
    mode1(async ({ params, request }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      if (d.change_request.status !== "awaiting_answers") return invalidTransition(d.change_request, "clarifying");
      const answers = ((await readJson(request)).answers as string[] | undefined) ?? [];
      const round = d.change_request.clarifications.at(-1)!;
      if (answers.length !== round.questions.length || answers.some((a) => !String(a).trim())) {
        return fail(400, "VALIDATION_ERROR", `Cần đúng ${round.questions.length} câu trả lời`);
      }
      round.answers = answers;
      setCrStatus(d, "clarifying");
      runClarify(d);
      return okCr(d);
    }),
  ),

  // #21 Tìm vị trí + khoá (C-3, 3.5)
  http.post(
    api("/projects/:projectId/change-requests/:crId/impact"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (cr.status !== "impact_review" || d.locations.length > 0) return invalidTransition(cr, "impact_review");
      const words = keywordsOf(cr);
      const hits = latestBlocks().filter((b) => b.editable && b.kind !== "heading" && words.some((w) => b.text.toLowerCase().includes(w)));
      const found = hits.length ? hits : latestBlocks().filter((b) => b.kind === "paragraph").slice(0, 1);
      const conflicts = lock(cr.cr_id, found.map((b) => b.block_id));
      if (conflicts.length) return fail(409, "BLOCK_LOCKED", `Block ${conflicts[0].block_id} đang được ${conflicts[0].cr_id} sửa`, { locked: conflicts });
      d.locations = found.map((b, i): CrLocation => ({
        location_id: `L${String(i + 1).padStart(3, "0")}`,
        block_id: b.block_id,
        block: null,
        found_by: b.mentions.length ? ["mention", "keyword"] : ["keyword"],
        entity_paths: b.mentions.map((m) => `${m.entity}s[id=${m.id}]`),
        owner_step: null,
        conclusion: null,
        reason: null,
        proposal: null,
        manual: false,
        redo_count: 0,
        verify: null,
        group_id: null,
      }));
      return okCr(d);
    }),
  ),

  // #22 Đề xuất (C-4)
  http.post(
    api("/projects/:projectId/change-requests/:crId/propose"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      const fromImpact = cr.status === "impact_review" && d.locations.length > 0;
      if (!fromImpact && cr.status !== "proposing") return invalidTransition(cr, "proposing");
      runPropose(d);
      return okCr(d);
    }),
  ),

  // #23 Sửa tay / kết luận tay
  http.patch(
    api("/projects/:projectId/change-requests/:crId/locations/:locId"),
    mode1(async ({ params, request }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (!["proposing", "manual_fix", "ready_to_submit"].includes(cr.status)) return invalidTransition(cr, "verifying");
      const loc = d.locations.find((l) => l.location_id === params.locId);
      if (!loc) return fail(404, "CR_LOCATION_NOT_FOUND", `Không có vị trí ${String(params.locId)}`);
      const body = (await readJson(request)) as { conclusion?: CrLocation["conclusion"]; reason?: string; new_text?: string; comment_text?: string };
      if (!Object.keys(body).length) return fail(400, "VALIDATION_ERROR", "Cần ít nhất một field để sửa");
      if (body.conclusion === "edit" && body.new_text === undefined) return fail(400, "VALIDATION_ERROR", "Kết luận edit cần new_text");
      if (body.conclusion === "comment" && !body.comment_text) return fail(400, "VALIDATION_ERROR", "Kết luận comment cần comment_text");
      if (body.conclusion === "not_related" && !body.reason) return fail(400, "VALIDATION_ERROR", "Kết luận not_related cần lý do");
      const oldText = loc.proposal?.old_text ?? latestBlocks().find((b) => b.block_id === loc.block_id)?.text ?? "";
      loc.conclusion = body.conclusion ?? loc.conclusion;
      loc.reason = body.reason ?? loc.reason;
      loc.proposal = {
        old_text: oldText,
        new_text: body.new_text ?? loc.proposal?.new_text ?? null,
        comment_text: body.comment_text ?? loc.proposal?.comment_text ?? null,
        spine_ops: loc.proposal?.spine_ops ?? [],
      };
      loc.manual = true;
      regroup(d);
      if (cr.status === "ready_to_submit") setCrStatus(d, "verifying");
      return okCr(d);
    }),
  ),

  // #24 Verify (C-5)
  http.post(
    api("/projects/:projectId/change-requests/:crId/verify"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (!["proposing", "manual_fix", "verifying"].includes(cr.status)) return invalidTransition(cr, "verifying");
      setCrStatus(d, "verifying");
      runVerify(d);
      return okCr(d);
    }),
  ),

  // #25 Nộp
  http.post(
    api("/projects/:projectId/change-requests/:crId/submit"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      const open = d.locations.filter((l) => !l.conclusion).map((l) => l.location_id);
      if (open.length) return fail(409, "CR_LOCATION_UNCONCLUDED", "Còn vị trí chưa có kết luận", { location_ids: open });
      if (cr.status !== "ready_to_submit") return invalidTransition(cr, "in_review");
      cr.submitted_at = now();
      setCrStatus(d, "in_review");
      return okCr(d);
    }),
  ),

  // #26 Duyệt / từ chối group (+ C-7 khi group cuối được quyết)
  http.post(
    api("/projects/:projectId/change-requests/:crId/groups/:gid/decision"),
    mode1(async ({ params, request }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (cr.status !== "in_review") return invalidTransition(cr, "written");
      const group = d.groups.find((g) => g.group_id === params.gid);
      if (!group) return fail(404, "CR_GROUP_NOT_FOUND", `Không có group ${String(params.gid)}`);
      const body = await readJson(request);
      const conflict = versionConflict(body.base_version);
      if (conflict) return conflict;
      if (body.decision !== "approved" && body.decision !== "rejected") return fail(400, "VALIDATION_ERROR", "decision phải là approved hoặc rejected");
      if (body.decision === "rejected" && String(body.reason ?? "").trim().length < DECISION_REASON_MIN_LENGTH) {
        return fail(400, "VALIDATION_ERROR", `Từ chối cần lý do ≥ ${DECISION_REASON_MIN_LENGTH} ký tự`);
      }
      Object.assign(group, { decision: body.decision, reason: (body.reason as string | undefined) ?? null, decided_by: MODE1_USER_ID, decided_at: now() });
      if (group.decision === "rejected") {
        unlock(cr.cr_id, d.locations.filter((l) => group.location_ids.includes(l.location_id)).map((l) => l.block_id));
      }
      const pending = d.groups.some((g) => g.decision === "pending");
      if (!pending && d.groups.some((g) => g.decision === "approved")) writeCr(d);
      return okCr(d);
    }),
  ),

  // #27 Sửa lại khi mọi group bị từ chối
  http.post(
    api("/projects/:projectId/change-requests/:crId/revise"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (cr.status !== "in_review" || d.groups.some((g) => g.decision !== "rejected")) return invalidTransition(cr, "proposing");
      const conflicts = lock(cr.cr_id, d.locations.map((l) => l.block_id));
      if (conflicts.length) return fail(409, "BLOCK_LOCKED", `Block ${conflicts[0].block_id} đang được ${conflicts[0].cr_id} sửa`, { locked: conflicts });
      for (const l of d.locations) Object.assign(l, { conclusion: null, reason: null, proposal: null, manual: false, redo_count: 0, verify: null, group_id: null });
      d.groups = [];
      setCrStatus(d, "proposing");
      return okCr(d);
    }),
  ),

  // #28 Đóng (mọi group bị từ chối) · #29 Huỷ
  http.post(
    api("/projects/:projectId/change-requests/:crId/close"),
    mode1(async ({ params, request }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      const reason = String((await readJson(request)).reason ?? "").trim();
      if (reason.length < DECISION_REASON_MIN_LENGTH) return fail(400, "VALIDATION_ERROR", `Cần lý do ≥ ${DECISION_REASON_MIN_LENGTH} ký tự`);
      if (cr.status !== "in_review" || d.groups.some((g) => g.decision !== "rejected")) return invalidTransition(cr, "rejected");
      unlock(cr.cr_id);
      cr.closed_reason = reason;
      setCrStatus(d, "rejected");
      return okCr(d);
    }),
  ),
  http.post(
    api("/projects/:projectId/change-requests/:crId/cancel"),
    mode1(async ({ params, request }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      const reason = String((await readJson(request)).reason ?? "").trim();
      if (reason.length < DECISION_REASON_MIN_LENGTH) return fail(400, "VALIDATION_ERROR", `Cần lý do ≥ ${DECISION_REASON_MIN_LENGTH} ký tự`);
      if (CR_TERMINAL_STATUSES.includes(cr.status)) return invalidTransition(cr, "cancelled");
      unlock(cr.cr_id);
      cr.closed_reason = reason;
      cr.paused = null;
      setCrStatus(d, "cancelled");
      return okCr(d);
    }),
  ),

  // #30 Resume CR sau pause
  http.post(
    api("/projects/:projectId/change-requests/:crId/resume"),
    mode1(({ params }) => {
      const d = crOr404(params.crId);
      if (d instanceof Response) return d;
      const cr = d.change_request;
      if (!cr.paused) return invalidTransition(cr, cr.status);
      if (cr.status === "clarifying") runClarify(d);
      else if (cr.status === "proposing") runPropose(d);
      else if (cr.status === "verifying") runVerify(d);
      return okCr(d);
    }),
  ),

  // #31 Release
  http.post(
    api("/projects/:projectId/release"),
    mode1(async ({ request }) => {
      const conflict = versionConflict((await readJson(request)).base_version);
      if (conflict) return conflict;
      const from = latestVersion();
      if (!from) return fail(409, "IMPORT_INVALID_STATE", "Chưa có tài liệu để release");
      if (S().redFlags > 0) return fail(422, "RELEASE_RED_FLAGS_OPEN", `Còn ${S().redFlags} cờ đỏ — chưa release được`, { flags: [redFlag()] });
      const lastRelease = S().versions.filter((v) => v.kind === "release").map((v) => v.version).sort(compareDocVersions).at(-1);
      const crIds = [...S().crs.values()]
        .map((d) => d.change_request)
        .filter((c) => c.status === "written" && (!lastRelease || compareDocVersions(c.result_doc_version!, lastRelease) > 0))
        .map((c) => c.cr_id);
      const to = nextMajor(from);
      S().spineVersion += 1;
      const baseline = newBaseline("release", to);
      S().baselines.push(baseline);
      S().blocks.set(to, latestBlocks().map((b) => ({ ...b, doc_version: to, revisions: undefined })));
      const version = addVersion({ version: to, kind: "release", based_on: from, cr_ids: crIds, baseline_id: baseline.id, has_clean_file: true });
      return ok({ version, baseline, cr_ids: crIds, spine_version: S().spineVersion });
    }),
  ),

  // Spine (chỉ mục) + cờ của project mode 1 — FE đọc `spine_version` làm `base_version`, đếm cờ đỏ để chặn Release.
  // Project khác trả `undefined` ⇒ rơi xuống mock pipeline.
  http.get(api("/projects/:projectId/spine"), ({ params }) =>
    isMode1(params.projectId)
      ? ok({ projectId: MODE1_PROJECT_ID, spine_version: S().spineVersion, flags: openFlags(), baselines: S().baselines, sections: [], steps: [] })
      : undefined,
  ),
  http.get(api("/projects/:projectId/flags"), ({ params, request }) => {
    if (!isMode1(params.projectId)) return undefined;
    const level = new URL(request.url).searchParams.get("level");
    return ok(openFlags().filter((f) => !level || f.level === level));
  }),
  http.get(api("/billing/balance"), () =>
    ok({ balance: S().credits, reserved: 0, available: S().credits, plan: "free", planLabel: "Free", lowCreditThreshold: 10, subscription: null, ledger: [] }),
  ),

  // G9 / BR-03: project mode 1 không sửa qua /changes, /undo, reconcile hay chat — trả 409 kèm prefill CR.
  ...(["/changes", "/changes/preview", "/reconcile", "/undo"] as const).map((path) =>
    http.post(api(`/projects/:projectId${path}`), async ({ params, request }) => {
      if (!isMode1(params.projectId)) return undefined;
      const body = await readJson(request.clone());
      return requiresCr(String(body.instruction ?? body.reason ?? ""));
    }),
  ),
  http.post(api("/projects/:projectId/chats/:chatId/messages/stream"), async ({ params, request }) => {
    if (!isMode1(params.projectId)) return undefined;
    const content = String((await readJson(request.clone())).content ?? "");
    if (CHANGE_VERB.test(content)) return requiresCr(content);
    return undefined;
  }),
];
