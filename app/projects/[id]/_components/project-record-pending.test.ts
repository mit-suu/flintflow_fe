import { describe, expect, it } from "vitest";
import type { Spine } from "@/types/spine";
import { pendingRecordCount } from "./project-record-pending";

const spine = (over: Partial<Record<"assumptions" | "addendum" | "screens" | "other_requirements", unknown[]>> & { phase?: string } = {}): Spine =>
  ({
    assumptions: over.assumptions ?? [],
    addendum: over.addendum ?? [],
    screens: over.screens ?? [],
    other_requirements: over.other_requirements ?? [],
    progress: { current_phase: over.phase ?? "S-2" },
  }) as unknown as Spine;

describe("pendingRecordCount - chỉ đếm việc có nút hành động", () => {
  it("rủi ro, câu hỏi mở, rủi ro kỹ thuật không tính", () => {
    const s = spine({
      other_requirements: [
        { id: "O1", kind: "risk", statement: "x" },
        { id: "O2", kind: "open_question", statement: "y" },
        { id: "O3", kind: "technical_risk", statement: "z" },
      ],
    });
    expect(pendingRecordCount(s, true)).toBe(0);
    expect(pendingRecordCount(s, false)).toBe(0);
  });

  it("pha Brief: giả định chưa xác nhận + ghi chú Brief; ngoài pha Brief thì không", () => {
    const s = spine({
      assumptions: [{ status: "unconfirmed" }, { status: "unconfirmed" }, { status: "confirmed" }],
      addendum: [{ id: "N1" }],
    });
    expect(pendingRecordCount(s, true)).toBe(3);
    expect(pendingRecordCount(s, false)).toBe(0);
  });

  it("vòng soạn màn (S-5): màn chờ chốt mức chi tiết", () => {
    const screens = [{ detail_status: "pending" }, { detail_status: "detailed" }];
    expect(pendingRecordCount(spine({ screens, phase: "S-5" }), false)).toBe(1);
    expect(pendingRecordCount(spine({ screens, phase: "S-4" }), false)).toBe(0);
  });
});
