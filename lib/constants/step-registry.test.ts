import { describe, expect, it } from "vitest";
import {
  FIXED_STEP_COUNT,
  PHASES,
  PHASE_LABELS_VI,
  STEP_REGISTRY,
  getStepDef,
  loopKeys,
  orderedSteps,
  phaseOfStep,
  stepLabel,
  totalSteps,
} from "./step-registry";

const screens = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `S${String(i + 1).padStart(2, "0")}`, queue_order: i }));

describe("step registry FE (đồng bộ BE)", () => {
  it("13 Brief + 38 SRS cố định + 5 template S-5; mọi phase có nhãn", () => {
    expect(STEP_REGISTRY.filter((s) => s.id.startsWith("B-"))).toHaveLength(13);
    expect(STEP_REGISTRY.filter((s) => s.kind !== "loop")).toHaveLength(FIXED_STEP_COUNT);
    expect(STEP_REGISTRY.filter((s) => s.kind === "loop")).toHaveLength(5);
    for (const phase of PHASES) expect(PHASE_LABELS_VI[phase]).toBeTruthy();
  });

  it("N = 1 ⇒ 56 step; N = 20 (19 màn + non-screen) ⇒ 151 step", () => {
    const one = { screens: screens(1), functions: [] };
    expect(totalSteps(one)).toBe(56);
    expect(orderedSteps(one)).toHaveLength(56);

    const twenty = { screens: screens(19), functions: [{ screen_id: null }] };
    expect(loopKeys(twenty)).toHaveLength(20);
    expect(totalSteps(twenty)).toBe(151);
    expect(orderedSteps(twenty)).toHaveLength(151);
  });

  it("getStepDef / stepLabel / phaseOfStep", () => {
    expect(getStepDef("S-5.4@S01")).toMatchObject({ id: "S-5.4@S01", loop: "S01", phase: "S-5" });
    expect(getStepDef("S-5.4")).toBeUndefined();
    expect(getStepDef("S-3.1@S01")).toBeUndefined();
    expect(getStepDef("S-5.4@")).toBeUndefined();
    expect(stepLabel("S-3.1")).toBe("Actor");
    expect(stepLabel("S-5.2@nonscreen")).toBe("Kích hoạt & mô tả · không màn hình");
    expect(stepLabel("X-1")).toBe("X-1");
    expect(phaseOfStep("B-1.4")).toBe("B-1");
  });
});
