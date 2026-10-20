import { describe, expect, it } from "vitest";
import type { BaselineSubmission } from "@/types/spine";
import { editLockReason } from "./edit-lock";

const submission = (status: BaselineSubmission["status"]): BaselineSubmission => ({
  status,
  submitted_by: "u1",
  submitted_at: "2026-10-17T10:08:00.000Z",
  spine_version: 916,
  decided_by: null,
  decided_at: null,
  reason: null,
  rejection_comment_ids: [],
});

const base = { mode1: false, submission: null, runnerBusy: false, runnerNeedsInput: false };

describe("editLockReason", () => {
  it("không có gì chặn ⇒ null", () => {
    expect(editLockReason(base)).toBeNull();
    expect(editLockReason({ ...base, submission: submission("rejected") })).toBeNull();
  });

  it("FLF-293: đang chờ Lead duyệt ⇒ khoá, kể cả khi step không chạy", () => {
    expect(editLockReason({ ...base, submission: submission("pending") })).toMatch(/chờ Lead duyệt/);
  });

  it("step đang chạy / chờ trả lời ⇒ khoá với lý do riêng", () => {
    expect(editLockReason({ ...base, runnerBusy: true })).toMatch(/Bước đang chạy/);
    expect(editLockReason({ ...base, runnerNeedsInput: true })).toMatch(/Trả lời câu hỏi/);
  });

  it("mode 1 sửa qua change request ⇒ không khoá ở đây", () => {
    expect(editLockReason({ ...base, mode1: true, submission: submission("pending"), runnerBusy: true })).toBeNull();
  });
});
