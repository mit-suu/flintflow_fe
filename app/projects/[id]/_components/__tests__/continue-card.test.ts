import { describe, expect, it } from "vitest";
import { canShowContinueCard, type ContinueCardInput } from "../continue-card";

const base: ContinueCardInput = { mode1: false, canEdit: true, onPipelineSession: true, stepNotStarted: true, aiWorking: false, showOpening: false, sessionMessages: 5 };

describe("FLF-432 canShowContinueCard", () => {
  it("bước tới lượt chưa chạy, không lượt nào chạy, phiên có hội thoại ⇒ hiện", () => {
    expect(canShowContinueCard(base)).toBe(true);
  });
  it("AI đang chạy / phiên trống / lời mở đầu / Viewer / mode 1 / bước đã chạy ⇒ ẩn", () => {
    expect(canShowContinueCard({ ...base, aiWorking: true })).toBe(false);
    expect(canShowContinueCard({ ...base, sessionMessages: 0 })).toBe(false);
    expect(canShowContinueCard({ ...base, showOpening: true })).toBe(false);
    expect(canShowContinueCard({ ...base, canEdit: false })).toBe(false);
    expect(canShowContinueCard({ ...base, mode1: true })).toBe(false);
    expect(canShowContinueCard({ ...base, stepNotStarted: false })).toBe(false);
  });
});
