import { describe, expect, it } from "vitest";
import { answeredQuestionMessages } from "../answered-questions";

const ask = (step = "S-5.1@S12") => ({ role: "assistant", step, content: JSON.stringify({ reply: "Hai câu:", questions: [{ question: "Ai nhập điểm?" }] }) });

describe("P05 answeredQuestionMessages", () => {
  it("tin hỏi có tin user cùng bước ngay sau ⇒ đã trả lời, kèm câu trả lời", () => {
    const out = answeredQuestionMessages([ask(), { role: "user", step: "S-5.1@S12", content: "Giáo viên bộ môn" }]);
    expect(out.get(0)).toBe("Giáo viên bộ môn");
  });
  it("tin hỏi cuối cùng / tin AI thường / khác bước ⇒ chưa trả lời", () => {
    expect(answeredQuestionMessages([ask()]).size).toBe(0);
    expect(answeredQuestionMessages([{ role: "assistant", content: "xin chào" }, { role: "user", content: "ok" }]).size).toBe(0);
    expect(answeredQuestionMessages([ask("S-5.1@S12"), { role: "user", step: "S-5.2@S12", content: "x" }]).size).toBe(0);
  });
  it("FLF-449: tin hỏi có thẻ phương án đủ ưu / nhược / lý do khuyến nghị vẫn nhận ra là tin hỏi", () => {
    const card = {
      role: "assistant",
      step: "B-0.1",
      content: JSON.stringify({
        reply: "Một câu:",
        questions: [
          {
            question: "Kênh nhắc lịch?",
            recommendation_reason: "Bệnh nhân lớn tuổi",
            options: [{ label: "SMS (Khuyến nghị)", recommended: true, pros: ["Ai cũng nhận"], cons: ["Tốn phí"], risks: [] }, { label: "Zalo" }],
          },
        ],
      }),
    };
    expect(answeredQuestionMessages([card, { role: "user", step: "B-0.1", content: "SMS" }]).get(0)).toBe("SMS");
  });
});
