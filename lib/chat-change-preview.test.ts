import { describe, expect, it } from "vitest";
import { chatChangePreview } from "./chat-change-preview";

const preview = { ok: true, txn: "t", base_version: 3, ops: [], changes: [{}], violations: [], referrers: [], preview_id: "p1" };

describe("chatChangePreview - tin chat bị nhận là lệnh sửa phải có nút Áp dụng", () => {
  it("change_preview kèm bản xem trước có thay đổi ⇒ trả bản đó", () => {
    expect(chatChangePreview({ kind: "change_preview", reply: "…", preview })).toBe(preview);
  });

  it("tin thường, câu làm rõ, preview rỗng hoặc lỗi ⇒ null", () => {
    expect(chatChangePreview({ reply: "chào" })).toBeNull();
    expect(chatChangePreview(undefined)).toBeNull();
    expect(chatChangePreview({ kind: "change_clarification", reply: "?" })).toBeNull();
    expect(chatChangePreview({ kind: "change_preview", preview: { ...preview, changes: [] } })).toBeNull();
    expect(chatChangePreview({ kind: "change_preview", preview: { ...preview, ok: false } })).toBeNull();
    expect(chatChangePreview({ kind: "change_preview", preview_id: "p1", change_count: 2 })).toBeNull();
  });
});

describe("chatChangePreview - tự ghi và lệnh nhiều ý", () => {
  const auto = { ...preview, preview_id: undefined, auto_applied: true };
  it("change_applied kèm bản xem trước đã tự ghi ⇒ trả bản đó", () => {
    expect(chatChangePreview({ kind: "change_applied", preview: auto })).toBe(auto);
  });
  it("change_clarification kèm phần rõ có preview_id ⇒ trả bản xem trước; không có preview_id ⇒ null", () => {
    expect(chatChangePreview({ kind: "change_clarification", preview })).toBe(preview);
    expect(chatChangePreview({ kind: "change_clarification", preview: { ...preview, preview_id: undefined } })).toBeNull();
  });
});
