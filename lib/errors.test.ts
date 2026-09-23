import { describe, expect, it } from "vitest";
import { errorDetailLine, friendlyError } from "./errors";

describe("friendlyError (BUG-25)", () => {
  it("không bao giờ hiện mã kỹ thuật trong câu cho user", () => {
    const codes = ["STEP_NOT_RUNNABLE", "SPINE_VERSION_CONFLICT", "CALL_LIMIT", "NOT_IMPLEMENTED", "duplicate_id", "BASELINE_BLOCKED", "LẠ"];
    for (const code of codes) {
      const friendly = friendlyError(code, "This step isn't ready to run or review yet");
      expect(friendly.message, code).not.toContain(code === "LẠ" ? "KHÔNG-BAO-GIỜ-KHỚP" : code);
      expect(friendly.actions.length, code).toBeGreaterThan(0);
    }
  });

  it("step đang chạy ⇒ mời huỷ lượt cũ, kèm giờ bắt đầu lấy từ câu của BE", () => {
    const friendly = friendlyError("STEP_NOT_RUNNABLE", "Bước S-3.1 đang chạy ở lượt trước (bắt đầu 14:02) — huỷ lượt đó rồi chạy lại");
    expect(friendly.message).toContain("14:02");
    expect(friendly.actions[0].kind).toBe("cancel_and_rerun");
  });

  it("chưa tới lượt ⇒ chỉ đúng bước cần làm trước", () => {
    const friendly = friendlyError("STEP_NOT_RUNNABLE", "Step S-4.3 chưa tới lượt chạy");
    expect(friendly.actions[0]).toMatchObject({ kind: "goto_step", stepId: "S-4.3" });
  });

  it("xung đột phiên bản tự lành, không đổ lỗi cho phiên khác", () => {
    const friendly = friendlyError("SPINE_VERSION_CONFLICT", "Tài liệu vừa được thay đổi ở phiên khác");
    expect(friendly.selfHealing).toBe(true);
    expect(friendly.message).not.toContain("phiên khác");
  });

  it("lỗi op của lệnh sửa ⇒ mời sửa lại lệnh", () => {
    expect(friendlyError("duplicate_id", "").actions[0].kind).toBe("edit_command");
    expect(friendlyError("path_not_resolved", "").actions[0].kind).toBe("edit_command");
  });

  it("mã kỹ thuật chỉ nằm trong dòng chi tiết", () => {
    expect(errorDetailLine("NOT_IMPLEMENTED", "values is not iterable")).toBe("NOT_IMPLEMENTED: values is not iterable");
  });
});
