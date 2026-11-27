import { describe, expect, it } from "vitest";
import { isFlow2OpeningStep, startsFromFile } from "./flow2-start";

describe("flow2-start (FLF-461)", () => {
  it("B-0.x và B-1.x là bước mở đầu Luồng 2, bước khác thì không", () => {
    expect(isFlow2OpeningStep("B-0.1")).toBe(true);
    expect(isFlow2OpeningStep("B-1.1")).toBe(true);
    expect(isFlow2OpeningStep("B-2.1")).toBe(false);
    expect(isFlow2OpeningStep(null)).toBe(false);
  });
  it("có import_state và tên hệ thống từ file ⇒ AI tự mở lời, không hiện màn ý tưởng", () => {
    expect(startsFromFile({ hasImportState: true, hasSystemNameFromFile: true })).toBe(true);
  });
  it("khung mẫu trống hoặc dự án không từ file ⇒ chờ người dùng kể ý tưởng", () => {
    expect(startsFromFile({ hasImportState: true, hasSystemNameFromFile: false })).toBe(false);
    expect(startsFromFile({ hasImportState: false, hasSystemNameFromFile: true })).toBe(false);
  });
});
