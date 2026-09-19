import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/test/intl";
import { toStepAnswers } from "../ElicitPanel";
import { buildNameOps } from "../NamesGlossaryPanel";
import { describeEvent } from "../StepEventLog";

const questions = [
  { id: "q1", text: "Người dùng chính?" },
  { id: "q2", text: "Hệ thống ngoài?" },
  { id: "q3", text: "Ngôn ngữ?" },
];

describe("toStepAnswers", () => {
  it("một câu hỏi ⇒ nguyên văn câu trả lời", () => {
    expect(toStepAnswers([questions[0]], " Founder ")).toEqual([{ question_id: "q1", answer: "Founder" }]);
  });

  it("nhiều câu ⇒ tách dòng `n. ...`, bỏ câu không trả lời", () => {
    expect(toStepAnswers(questions, "1. Founder; Analyst\n3. Tiếng Anh")).toEqual([
      { question_id: "q1", answer: "Founder; Analyst" },
      { question_id: "q3", answer: "Tiếng Anh" },
    ]);
  });
});

describe("buildNameOps", () => {
  it("chỉ sinh op cho ô đã đổi, path theo khoá", () => {
    expect(buildNameOps("actors", "name", { A01: "Founder", A02: "Admin" }, { A01: "Founder", A02: " Administrator " })).toEqual([
      { op: "set", path: "actors[id=A02].name", value: "Administrator", reason: "Panel Tên riêng" },
    ]);
  });
});

const tLog = (locale: "vi" | "en") => createTranslator({ locale, messages: MESSAGES[locale], namespace: "workspace.stepLog" });

describe("describeEvent", () => {
  it("mô tả các sự kiện SSE", () => {
    const t = tLog("vi");
    expect(describeEvent({ type: "gate_ready", step_id: "S-3.1", actions: ["accept"], regenerate_used: 0, calls_used: 2 }, t)).toBe("Sẵn sàng duyệt");
    expect(describeEvent({ type: "error", step_id: "S-3.1", code: "CALL_LIMIT", message: "Hết lượt", retryable: false }, t)).toContain("CALL_LIMIT");
  });

  it("dịch theo ngôn ngữ, kể cả số ít / số nhiều", () => {
    const t = tLog("en");
    expect(describeEvent({ type: "gate_ready", step_id: "S-3.1", actions: ["accept"], regenerate_used: 0, calls_used: 2 }, t)).toBe("Ready for review");
    expect(describeEvent({ type: "flags", step_id: "S-3.1", red_open: 1, yellow_open: 2 } as never, t)).toBe("Check: 1 red flag, 2 yellow flags");
    expect(describeEvent({ type: "answer_needed", step_id: "S-3.1", questions: [{ id: "q1", text: "?" }] } as never, t)).toBe(
      "Waiting for you to answer 1 question"
    );
  });
});
