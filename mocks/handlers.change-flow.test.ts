import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSpine, previewChanges, applyChanges, reconcile, undoLastChange, listChanges, getTraceability } from "@/lib/api/spine";
import { listFlags, recomputeFlags, waiveFlag } from "@/lib/api/flags";
import { assembleDocument, getDocument, downloadWordExport } from "@/lib/api/export";
import { apiCall } from "@/lib/api/client";
import { mockTiming, resetMockChangeFlowState } from "./handlers";
import { mockServer } from "./server";
import { MOCK_PROJECT_ID, resetMockState } from "./state";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

/** Seed một actor bằng ops thuần (không đi qua Change panel) để lệnh tự nhiên có đối tượng để sửa. */
const seedActor = async () => {
  const base_version = await version();
  await applyChanges(P, {
    base_version,
    ops: [{ op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Ban đầu" } }],
  });
  return version();
};

describe("mock T16: changes/preview → apply → undo → reconcile trên mock", () => {
  it("preview theo instruction rồi xác nhận qua POST /changes ghi Spine thật", async () => {
    const base_version = await seedActor();
    const preview = await previewChanges(P, { instruction: "làm rõ vai trò", base_version });
    expect(preview.data?.ok).toBe(true);
    expect(preview.data?.preview_id).toBeTruthy();
    expect(preview.data?.changes.length).toBeGreaterThan(0);

    const applied = await applyChanges(P, {
      instruction: "làm rõ vai trò",
      base_version,
      preview_id: preview.data!.preview_id!,
    });
    expect(applied.data?.spine_version).toBe(base_version + 1);
    expect(applied.data?.changes[0]?.path).toContain("actors[id=");
  });

  it("preview không tìm được đối tượng (chưa có actor) ⇒ trả clarification, không có preview_id", async () => {
    const base_version = await version();
    const preview = await previewChanges(P, { instruction: "đổi gì đó", base_version });
    expect(preview.data?.clarification).toBeTruthy();
    expect(preview.data?.preview_id).toBeUndefined();
  });

  it("NOTHING_TO_UNDO khi chưa có thao tác nào qua Change panel", async () => {
    const base_version = await version();
    await expect(undoLastChange(P, { base_version })).rejects.toMatchObject({ code: "NOTHING_TO_UNDO" });
  });

  it("undo op cuối (áp qua preview) trả lại giá trị trước đó", async () => {
    const base_version = await seedActor();
    const preview = await previewChanges(P, { instruction: "cập nhật mô tả", base_version });
    const applied = await applyChanges(P, {
      instruction: "cập nhật mô tả",
      base_version,
      preview_id: preview.data!.preview_id!,
    });
    const appliedVersion = applied.data!.spine_version;
    expect(applied.data?.spine.actors[0]?.description).toContain("cập nhật mô tả");

    const undone = await undoLastChange(P, { base_version: appliedVersion });
    expect(undone.data?.spine.actors[0]?.description).toBe("Ban đầu");
  });

  it("undo một lô nhiều change (add rồi set trong cùng txn) trả lại đúng trạng thái trước lô, theo seq giảm dần", async () => {
    const base_version = await version();
    // Preview với 2 ops trong cùng lô (add actor mới rồi set mô tả) — trace qua Change panel nên áp
    // (`preview_id` + `instruction`) mới ghi vào `mockChangesLog`, dùng được cho undo.
    const preview = await previewChanges(P, {
      base_version,
      ops: [
        { op: "add", path: "actors[]", value: { id: "A09", name: "Ops Bot", kind: "system", description: "Ban đầu" } },
        { op: "set", path: "actors[id=A09].description", value: "Đã đổi", reason: "chỉnh mô tả" },
      ],
    });
    const applied = await applyChanges(P, {
      instruction: "thêm actor rồi chỉnh mô tả",
      base_version,
      preview_id: preview.data!.preview_id!,
    });
    expect(applied.data?.spine.actors.some((a) => a.id === "A09")).toBe(true);
    expect(applied.data?.spine.actors.find((a) => a.id === "A09")?.description).toBe("Đã đổi");

    const undone = await undoLastChange(P, { base_version: applied.data!.spine_version });
    // `before={_absent:true}` của op add ⇒ undo phải xoá hẳn actor, không để lại marker trong field.
    expect(undone.data?.spine.actors.some((a) => a.id === "A09")).toBe(false);
  });

  it("reconcile hai bước: lượt đầu trả preview, lượt hai (kèm preview_id) áp lô", async () => {
    const base_version = await version();
    const first = await reconcile(P, { base_version });
    expect(first.data && "ok" in first.data).toBe(true);
    const previewId = (first.data as { preview_id?: string }).preview_id;

    const second = await reconcile(P, { base_version, preview_id: previewId });
    expect(second.data && "spine_version" in second.data).toBe(true);
  });

  it("GET /changes trả lịch sử thao tác đã áp qua Change panel", async () => {
    const base_version = await seedActor();
    const preview = await previewChanges(P, { instruction: "ghi log", base_version });
    await applyChanges(P, { instruction: "ghi log", base_version, preview_id: preview.data!.preview_id! });

    const history = await listChanges(P);
    expect(history.data?.length).toBeGreaterThan(0);
  });

  it("traceability trả actor + use case liên quan", async () => {
    await seedActor();
    const trace = await getTraceability(P, { entity: "actor", id: "A01" });
    expect(trace.data?.nodes.some((n) => n.id === "A01")).toBe(true);
  });
});

describe("mock T16: flags waive/recompute", () => {
  it("waive rule cấm (array_empty) trả FLAG_NOT_WAIVABLE", async () => {
    const base_version = await version();
    await applyChanges(P, {
      base_version,
      ops: [
        {
          op: "add",
          path: "flags[]",
          value: {
            id: "FLX",
            level: "red",
            rule_id: "array_empty",
            section_id: "fixed:2.1",
            message: "Actors rỗng",
            remediation_step: "S-3.1",
            opened_at_version: 1,
            resolved_at: null,
            waived_by_user: false,
            waive_reason: null,
            waived_at_version: null,
          },
        },
      ],
    });

    await expect(waiveFlag(P, "FLX", "Lý do đủ dài để vượt ngưỡng 20 ký tự")).rejects.toMatchObject({
      code: "FLAG_NOT_WAIVABLE",
    });
  });

  it("waive hợp lệ cập nhật flag; recompute trả meta", async () => {
    const base_version = await version();
    await applyChanges(P, {
      base_version,
      ops: [
        {
          op: "add",
          path: "flags[]",
          value: {
            id: "FLY",
            level: "yellow",
            rule_id: "orphan_actor",
            section_id: "fixed:2.1",
            message: "Actor mồ côi",
            remediation_step: "S-3.1",
            opened_at_version: 1,
            resolved_at: null,
            waived_by_user: false,
            waive_reason: null,
            waived_at_version: null,
          },
        },
      ],
    });

    const waived = await waiveFlag(P, "FLY", "Chấp nhận vì phạm vi MVP hiện tại");
    expect(waived.data?.waived_by_user).toBe(true);

    const recomputed = await recomputeFlags(P);
    expect(recomputed.meta?.checked_at_version).toBeDefined();

    const flags = await listFlags(P);
    expect(flags.data?.find((f) => f.id === "FLY")?.waived_by_user).toBe(true);
  });
});

describe("mock T16: assemble/document/export", () => {
  it("GET /document trước khi assemble ⇒ 409 NO_WORKING_DRAFT kèm hint S-8.2", async () => {
    await expect(getDocument(P)).rejects.toMatchObject({ code: "NO_WORKING_DRAFT", status: 409 });
  });

  it("assemble rồi GET /document trả RenderedDocument + meta", async () => {
    const base_version = await version();
    await assembleDocument(P, base_version);
    const doc = await getDocument(P);
    expect(doc.data?.sections.length).toBeGreaterThan(0);
    expect(doc.meta?.assembled_at_version).toBe(base_version);
    expect(doc.meta?.stale).toBe(false);
  });

  it("export word trả {blob, filename} sau khi assemble; 409 khi chưa assemble", async () => {
    await expect(downloadWordExport(P)).rejects.toMatchObject({ code: "NO_WORKING_DRAFT", status: 409 });
    await assembleDocument(P, await version());
    const { blob, filename } = await downloadWordExport(P);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toContain("-draft.docx");
  });
});

describe("mock T16: PATCH /users/me (onboarding)", () => {
  it("cập nhật name/onboardedAt rồi GET /users/me phản ánh đúng", async () => {
    await apiCall("/users/me", { method: "PATCH", body: JSON.stringify({ name: "Hiệp" }) });
    await apiCall("/users/me", { method: "PATCH", body: JSON.stringify({ onboardedAt: "2026-09-15T00:00:00.000Z" }) });

    const me = await apiCall<{ name?: string; onboardedAt?: string }>("/users/me");
    expect(me.data?.name).toBe("Hiệp");
    expect(me.data?.onboardedAt).toBe("2026-09-15T00:00:00.000Z");
  });
});
