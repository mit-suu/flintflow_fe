import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, localeOf, tPhase, tPhaseOfStep, tStep } from "./i18n";
import { getStepDef } from "./constants/step-registry";

describe("tStep — nhãn lấy từ step registry, không có bảng dịch chép tay", () => {
  it("step thường: đúng label_vi / label_en của registry", () => {
    const def = getStepDef("S-3.1")!;
    expect(tStep("S-3.1", "vi")).toBe(def.label_vi);
    expect(tStep("S-3.1", "en")).toBe(def.label_en);
    expect(def.label_vi).not.toBe(def.label_en);
  });

  it("step vòng S-5 kèm khoá màn ở cả hai ngôn ngữ", () => {
    expect(tStep("S-5.2@S07", "vi")).toContain("· S07");
    expect(tStep("S-5.2@S07", "en")).toContain("· S07");
  });

  it("vòng không màn hình dịch theo ngôn ngữ", () => {
    expect(tStep("S-5.2@nonscreen", "vi")).toContain("không màn hình");
    expect(tStep("S-5.2@nonscreen", "en")).toContain("non-screen");
  });

  it("step lạ trả về chính id — hiện sai còn hơn hiện rỗng", () => {
    expect(tStep("KHONG-CO", "vi")).toBe("KHONG-CO");
  });

  it("mặc định là tiếng Việt", () => {
    expect(tStep("S-3.1")).toBe(tStep("S-3.1", DEFAULT_LOCALE));
    expect(DEFAULT_LOCALE).toBe("vi");
  });
});

describe("tPhase", () => {
  it("dịch được cả hai chiều và khác nhau", () => {
    const vi = tPhase("S-3", "vi");
    const en = tPhase("S-3", "en");
    expect(vi).toBeTruthy();
    expect(en).toBeTruthy();
    expect(vi).not.toBe(en);
  });

  it("phase lạ trả về chính nó", () => {
    expect(tPhase("X-9", "vi")).toBe("X-9");
  });

  it("tPhaseOfStep suy ra phase từ step id, kể cả step vòng", () => {
    expect(tPhaseOfStep("S-5.2@S07", "en")).toBe(tPhase("S-5", "en"));
    expect(tPhaseOfStep("B-1.3", "vi")).toBe(tPhase("B-1", "vi"));
  });
});

describe("localeOf", () => {
  it("chưa có field locale ⇒ luôn tiếng Việt", () => {
    expect(localeOf(null)).toBe("vi");
    expect(localeOf(undefined)).toBe("vi");
    expect(localeOf({})).toBe("vi");
  });

  it("nhận đúng locale hợp lệ, bỏ qua giá trị lạ", () => {
    expect(localeOf({ locale: "en" })).toBe("en");
    expect(localeOf({ locale: "fr" })).toBe("vi");
    expect(localeOf({ locale: null })).toBe("vi");
  });
});
