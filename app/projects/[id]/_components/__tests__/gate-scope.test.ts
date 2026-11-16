import { describe, expect, it } from "vitest";
import { isFlagInGateScope } from "../gate-helpers";

describe("isFlagInGateScope (FLF-411 #19)", () => {
  it("cổng một bước: chỉ cờ mà bước đó sở hữu", () => {
    const scope = { stepId: "B-1.1" };
    expect(isFlagInGateScope({ remediation_step: "B-1.1" }, scope)).toBe(true);
    // "4.2.2 chưa có dữ liệu" thuộc bước S-6.x, không nêu ở cổng "Tầm nhìn"
    expect(isFlagInGateScope({ remediation_step: "S-6.3" }, scope)).toBe(false);
    expect(isFlagInGateScope({ remediation_step: "" }, scope)).toBe(false);
  });

  it("cổng cuối giai đoạn: mọi bước của giai đoạn, kể cả bước vòng màn", () => {
    const scope = { stepId: "S-5.5@S03", phase: "S-5", stepIds: ["S-5.1@S03", "S-5.5@S03"] };
    expect(isFlagInGateScope({ remediation_step: "S-5.1@S03" }, scope)).toBe(true);
    expect(isFlagInGateScope({ remediation_step: "S-5.2@S03" }, scope)).toBe(true);
    expect(isFlagInGateScope({ remediation_step: "S-4.2" }, scope)).toBe(false);
  });
});
