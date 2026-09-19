import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { nextStepLabel as nextStepLabelWith } from "./ProjectCard";
import { tStep, type Locale } from "@/lib/i18n";
import { MESSAGES } from "@/test/intl";
import type { ProgressResponse } from "@/types/pipeline";

/** Bản gọn: dùng đúng bản dịch thật của `app.projectCard` theo ngôn ngữ. */
const nextStepLabel = (progress: ProgressResponse | null | undefined, locale: Locale = "vi") =>
  nextStepLabelWith(progress, locale, createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.projectCard" }));

const progress = (over: Partial<ProgressResponse["progress"]> = {}, readiness: Partial<ProgressResponse["readiness"]> = {}): ProgressResponse => ({
  readiness: { accepted_pct: 0, awaiting_reaccept: 0, red_open: 0, stale: 0, ...readiness },
  progress: { done: 0, total: 51, current_phase: null, current_step: null, show_percent: false, ...over },
  sections: [],
});

describe("nextStepLabel — việc tiếp theo lấy từ step registry", () => {
  it("đang tải ⇒ nói đang tải, không hiện nhãn sai", () => {
    expect(nextStepLabel(undefined)).toBe("Đang tải…");
  });

  it("project chưa có Spine ⇒ mời bắt đầu, không hiện mã step thô", () => {
    expect(nextStepLabel(null)).toContain("Chưa bắt đầu");
  });

  it("có Spine nhưng chưa chạy step nào ⇒ vẫn là chưa bắt đầu", () => {
    expect(nextStepLabel(progress())).toContain("Chưa bắt đầu");
  });

  it("đang ở một step ⇒ đúng nhãn của registry, không phải bảng cứng cũ", () => {
    expect(nextStepLabel(progress({ current_step: "S-3.1" }))).toBe(tStep("S-3.1", "vi"));
  });

  it("step vòng S-5 hiện kèm khoá màn", () => {
    expect(nextStepLabel(progress({ current_step: "S-5.4@S07" }))).toContain("S07");
  });

  it("chưa bắt đầu / đang tải cũng dịch theo ngôn ngữ", () => {
    expect(nextStepLabel(undefined, "en")).toBe("Loading…");
    expect(nextStepLabel(null, "en")).toContain("Not started");
  });

  it("đổi ngôn ngữ thì nhãn đổi theo", () => {
    const vi = nextStepLabel(progress({ current_step: "S-3.1" }), "vi");
    const en = nextStepLabel(progress({ current_step: "S-3.1" }), "en");
    expect(vi).not.toBe(en);
  });
});
