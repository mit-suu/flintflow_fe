import { describe, expect, it } from "vitest";
import { applyAccountLocale, DEFAULT_LOCALE, localeOf, resolveLocale, tPhase, tPhaseOfStep, tStep } from "./i18n";
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

  it("bản vi giữ đúng nhãn cũ (thay cho stepLabel đã xoá)", () => {
    expect(tStep("S-3.1", "vi")).toBe("Actor");
    expect(tStep("S-5.2@nonscreen", "vi")).toBe("Kích hoạt & mô tả · không màn hình");
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

describe("resolveLocale — cookie → Accept-Language → vi", () => {
  it("cookie hợp lệ thắng header", () => {
    expect(resolveLocale("en", "vi-VN,vi;q=0.9")).toBe("en");
    expect(resolveLocale("vi", "en-US,en;q=0.9")).toBe("vi");
  });

  it("cookie lạ bị bỏ qua, rơi xuống header", () => {
    expect(resolveLocale("fr", "en-US")).toBe("en");
  });

  it("header: lấy ngôn ngữ hỗ trợ có trọng số q cao nhất, chỉ so phần ngôn ngữ chính", () => {
    expect(resolveLocale(null, "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale(null, "fr-FR,fr;q=0.9,en;q=0.5,vi;q=0.8")).toBe("vi");
    expect(resolveLocale(null, "vi;q=0.3, EN-GB;q=0.7")).toBe("en");
  });

  it("q=0 nghĩa là không chấp nhận", () => {
    expect(resolveLocale(null, "en;q=0, vi;q=0.1")).toBe("vi");
  });

  it("không có gì dùng được ⇒ vi", () => {
    expect(resolveLocale(undefined, undefined)).toBe("vi");
    expect(resolveLocale(null, "")).toBe("vi");
    expect(resolveLocale(null, "fr-FR,de;q=0.8")).toBe("vi");
  });
});

describe("applyAccountLocale — ngôn ngữ tài khoản sau khi đăng nhập (T25 · P6)", () => {
  it("locale hợp lệ ⇒ ghi cookie; thiếu / lạ ⇒ không đụng cookie", () => {
    document.cookie = "NEXT_LOCALE=vi; path=/";
    applyAccountLocale(undefined);
    applyAccountLocale("fr");
    expect(document.cookie).toContain("NEXT_LOCALE=vi");
    applyAccountLocale("en");
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  });
});
