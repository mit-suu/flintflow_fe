import { describe, expect, it } from "vitest";
import { canShowRerunCard } from "../rerun-card";

describe("FLF-431 canShowRerunCard", () => {
  it("cổng Ký baseline (S-9.5) đang mở, xem bước khác đã mở lại ⇒ hiện nút chạy lại", () => {
    expect(canShowRerunCard(false, { status: "gate_ready", stepId: "S-9.5" }, "S-3.2")).toBe(true);
  });
  it("runner rảnh ⇒ hiện", () => {
    expect(canShowRerunCard(false, { status: "idle", stepId: null }, "S-3.2")).toBe(true);
  });
  it("AI đang chạy, hoặc runner đang ở chính bước đang xem ⇒ ẩn", () => {
    expect(canShowRerunCard(true, { status: "gate_ready", stepId: "S-9.5" }, "S-3.2")).toBe(false);
    expect(canShowRerunCard(false, { status: "gate_ready", stepId: "S-3.2" }, "S-3.2")).toBe(false);
    expect(canShowRerunCard(false, { status: "needs_input", stepId: "S-3.2" }, "S-3.2")).toBe(false);
  });
});
