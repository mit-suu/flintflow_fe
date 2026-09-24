import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import QuestionStepperInput, { formatAnswers } from "../QuestionStepperInput";
import { directReplyAnswers } from "../ElicitPanel";

const questions = [
  { question: "Mô hình kinh doanh?", suggestedAnswers: ["Bán xe mới", "Xe cũ", "Cho thuê"], multiple: false },
  { question: "Kênh bán nào?", suggestedAnswers: ["Online", "Cửa hàng"], multiple: true },
];

describe("QuestionStepperInput", () => {
  it("chọn 1 đáp án tự sang câu kế; câu cuối gửi đủ các dòng `n. ...`", () => {
    const onSend = vi.fn();
    render(<QuestionStepperInput questions={questions} onSendAnswers={onSend} onDismiss={() => undefined} />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Xe cũ/ }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Online/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Cửa hàng/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));

    expect(onSend).toHaveBeenCalledWith("1. Xe cũ\n2. Online; Cửa hàng");
  });

  it("phím số chọn đáp án; câu chưa trả lời có nút Bỏ qua", () => {
    const onSend = vi.fn();
    render(<QuestionStepperInput questions={questions} onSendAnswers={onSend} />);

    const card = screen.getByRole("group", { name: "Câu hỏi 1 trên 2" });
    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeInTheDocument();
    fireEvent.keyDown(card, { key: "3" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // Không truyền onDismiss ⇒ không có nút đóng
    expect(screen.queryByRole("button", { name: "Đóng câu hỏi" })).not.toBeInTheDocument();
  });

  it("câu cuối chưa có đáp án nào ⇒ nút gửi bị khoá", () => {
    render(<QuestionStepperInput questions={[questions[0]]} onSendAnswers={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Gửi câu trả lời" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Câu trả lời khác"), { target: { value: "Bán phụ tùng" } });
    expect(screen.getByRole("button", { name: "Gửi câu trả lời" })).toBeEnabled();
  });
});

describe("QuestionStepperInput — câu cuối bỏ qua được", () => {
  it("đã trả lời câu trước ⇒ Bỏ qua ở câu cuối gửi phần đã có", () => {
    const onSend = vi.fn();
    render(<QuestionStepperInput questions={questions} onSendAnswers={onSend} />);
    fireEvent.click(screen.getByRole("radio", { name: /Cho thuê/ }));
    // Câu cuối chưa chọn gì: nút gửi khoá nhưng có Bỏ qua
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(onSend).toHaveBeenCalledWith("1. Cho thuê");
  });

  it("chưa trả lời gì ⇒ Bỏ qua ở câu cuối đóng thẻ (nếu đóng được)", () => {
    const onDismiss = vi.fn();
    render(<QuestionStepperInput questions={[questions[0]]} onSendAnswers={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("formatAnswers", () => {
  it("một câu ⇒ nguyên văn, gộp phần bổ sung", () => {
    expect(formatAnswers(1, { 0: ["Bán xe mới"] }, { 0: " kèm bảo hành " })).toBe("Bán xe mới (Bổ sung: kèm bảo hành)");
  });
});

describe("directReplyAnswers", () => {
  const qs = [
    { id: "q1", text: "Người dùng chính?" },
    { id: "q2", text: "Hệ thống ngoài?" },
  ];

  it("đoạn tự do ⇒ gán cho câu đầu", () => {
    expect(directReplyAnswers(qs, " Founder và kế toán ")).toEqual([{ question_id: "q1", answer: "Founder và kế toán" }]);
  });

  it("có dạng `n. ...` ⇒ tách theo câu; rỗng ⇒ không gửi", () => {
    expect(directReplyAnswers(qs, "2. Zalo OA")).toEqual([{ question_id: "q2", answer: "Zalo OA" }]);
    expect(directReplyAnswers(qs, "   ")).toEqual([]);
  });
});
