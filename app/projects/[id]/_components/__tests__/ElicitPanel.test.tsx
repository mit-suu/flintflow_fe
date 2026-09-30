import { describe, expect, it } from "vitest";
import { splitQuestions, toStepAnswers } from "../ElicitPanel";
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

describe("câu mở inline (đã hỏi trong lời AI)", () => {
  const qs = [
    { id: "Q1", text: "Bạn muốn app chạy trên nền tảng nào?", options: [{ label: "Web" }, { label: "Mobile" }] },
    { id: "Q2", text: "Ai là người duyệt lịch hẹn?", inline: true },
    { id: "Q3", text: "Có cần nhắc lịch không?" },
  ];

  it("không liệt kê câu inline thành dòng riêng khi lời AI đã chứa nó, nhưng vẫn là câu mở để ghép câu trả lời gõ tay", () => {
    const { card, open, listed } = splitQuestions(qs, "Mình đoán vậy. Ai là người duyệt lịch hẹn?  Bạn cho mình biết nhé.");
    expect(card.map((q) => q.id)).toEqual(["Q1"]);
    expect(open.map((q) => q.id)).toEqual(["Q2", "Q3"]);
    expect(listed.map((q) => q.id)).toEqual(["Q3"]);
    expect(toStepAnswers(open, "1. Lễ tân\n2. Có")).toEqual([
      { question_id: "Q2", answer: "Lễ tân" },
      { question_id: "Q3", answer: "Có" },
    ]);
  });

  it("câu inline mà lời AI KHÔNG chứa vẫn được liệt kê như câu mở thường (khỏi mất câu đang chờ trả lời)", () => {
    expect(splitQuestions(qs, "Mình đoán vậy, bạn xem giúp nhé.").listed.map((q) => q.id)).toEqual(["Q2", "Q3"]);
    expect(splitQuestions(qs).listed.map((q) => q.id)).toEqual(["Q2", "Q3"]);
    // khác khoảng trắng / hoa thường vẫn tính là đã chứa
    expect(splitQuestions(qs, "ai   là  người  DUYỆT lịch hẹn?").listed.map((q) => q.id)).toEqual(["Q3"]);
  });

  it("ChatBubble: câu inline không có trong reply vẫn hiện trong danh sách câu hỏi", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { default: ChatBubble } = await import("../ChatBubble");
    render(
      <ChatBubble
        message={{
          role: "ai",
          content: JSON.stringify({ reply: "Mình đoán vậy.", questions: [{ question: "Ai là người duyệt lịch hẹn?", inline: true }] }),
          createdAt: "2026-09-30T00:00:00.000Z",
        }}
      />
    );
    expect(screen.getByRole("list", { name: "Câu hỏi của AI" })).toHaveTextContent("Ai là người duyệt lịch hẹn?");
  });

  it("thẻ hỏi chỉ nhận câu có lựa chọn; ChatBubble không lặp câu inline", async () => {
    const { parseChatQuestion } = await import("@/lib/question-options");
    expect(parseChatQuestion({ question: "Ai duyệt?", inline: true })).toEqual({ question: "Ai duyệt?", options: [], multiple: undefined, inline: true });
    const { render, screen } = await import("@testing-library/react");
    const { default: ChatBubble } = await import("../ChatBubble");
    render(
      <ChatBubble
        message={{
          role: "ai",
          content: JSON.stringify({ reply: "Mình hỏi thêm: ai là người duyệt lịch hẹn? Bạn nói giúp nhé.", questions: [{ question: "Ai là người duyệt lịch hẹn?", inline: true }, { question: "Có cần nhắc lịch không?" }] }),
          createdAt: "2026-09-30T00:00:00.000Z",
        }}
      />
    );
    const list = screen.getByRole("list", { name: "Câu hỏi của AI" });
    expect(list).toHaveTextContent("Có cần nhắc lịch không?");
    expect(list).not.toHaveTextContent("Ai là người duyệt lịch hẹn?");
  });
});
