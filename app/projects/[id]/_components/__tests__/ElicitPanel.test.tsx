import { describe, expect, it } from "vitest";
import { toStepAnswers } from "../ElicitPanel";
import { buildNameOps } from "../NamesGlossaryPanel";
import { formatDuration, summaryLine, visibleStages } from "../StepProgress";

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

describe("StepProgress (tiến trình trực tiếp)", () => {
  it("chỉ hiện giai đoạn step thật sự có, theo đúng thứ tự, luôn kết bằng chờ duyệt", () => {
    const events = [
      { type: "stage", step_id: "S-3.1", stage: "intake", label_vi: "Đọc dữ liệu" },
      { type: "stage", step_id: "S-3.1", stage: "draft", label_vi: "AI soạn" },
    ] as const;
    expect(visibleStages([...events], "draft")).toEqual(["intake", "draft", "gate"]);
  });

  it("đồng hồ và dòng vừa ghi đọc được", () => {
    expect(formatDuration(47_000)).toBe("00:47");
    expect(formatDuration(65_400)).toBe("01:05");
    expect(summaryLine({ kind: "add", collection: "functions", id: "FN010", title_vi: "Cancel Appointment" })).toBe("+ Cancel Appointment");
  });
});
