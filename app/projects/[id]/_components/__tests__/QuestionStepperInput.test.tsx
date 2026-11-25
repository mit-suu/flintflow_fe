import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { fireEvent, screen } from "@testing-library/react";
import QuestionStepperInput, { answerValue, formatAnswers } from "../QuestionStepperInput";
import { directReplyAnswers, mergeAnswers, splitQuestions, toStepAnswers } from "../ElicitPanel";
import { isRecommendedOption, parseChatQuestion, splitRecommended, toDiscoveryQuestion } from "@/lib/question-options";
import type { DiscoveryQuestion } from "@/types/chat";

const opts = (...labels: string[]) => labels.map((label) => ({ label }));

const questions: DiscoveryQuestion[] = [
  {
    question: "Mô hình kinh doanh?",
    header: "Mô hình",
    options: [
      { label: "Bán xe mới (Khuyến nghị)", description: "Biên lợi nhuận cao" },
      { label: "Xe cũ" },
      { label: "Cho thuê" },
    ],
    multiple: false,
  },
  { question: "Kênh bán nào?", header: "Kênh bán", options: opts("Online", "Cửa hàng"), multiple: true },
];

describe("QuestionStepperInput", () => {
  it("tab theo header, khuyến nghị thành badge; chọn 1 tự sang câu kế; Xem lại rồi gửi (nhãn không kèm đuôi khuyến nghị)", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<QuestionStepperInput questions={questions} onSubmit={onSubmit} onDismiss={() => undefined} />);

    expect(screen.getByRole("tab", { name: "Mô hình" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Xem lại" })).toBeInTheDocument();
    expect(screen.getByText("Khuyến nghị")).toBeInTheDocument();
    expect(screen.getByText("Biên lợi nhuận cao")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Bán xe mới/ }));
    expect(screen.getByRole("tab", { name: "Kênh bán" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("checkbox", { name: /Online/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Cửa hàng/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));

    // Màn Xem lại: liệt kê đáp án, bấm Gửi
    expect(screen.getByRole("group", { name: "Xem lại câu trả lời" })).toBeInTheDocument();
    expect(screen.getByText("Online; Cửa hàng")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));
    expect(onSubmit).toHaveBeenCalledWith(["Bán xe mới", ["Online", "Cửa hàng"]]);
  });

  it("phím số chọn đáp án; dòng Khác… luôn có; không truyền onDismiss ⇒ không có nút đóng", () => {
    renderWithIntl(<QuestionStepperInput questions={questions} onSubmit={vi.fn()} />);
    const card = screen.getByRole("group", { name: "Câu hỏi 1 trên 2" });
    expect(screen.getByPlaceholderText("Khác…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeInTheDocument();
    fireEvent.keyDown(card, { key: "3" });
    expect(screen.getByRole("tab", { name: "Kênh bán" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Đóng câu hỏi" })).not.toBeInTheDocument();
  });

  it("một câu: không có tab Xem lại; chưa trả lời thì khoá Gửi, gõ Khác… thì gửi được chữ tự gõ", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<QuestionStepperInput questions={[questions[0]]} onSubmit={onSubmit} />);
    expect(screen.queryByRole("tab", { name: "Xem lại" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi câu trả lời" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Câu trả lời khác"), { target: { value: "Bán phụ tùng" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));
    expect(onSubmit).toHaveBeenCalledWith(["Bán phụ tùng"]);
  });

  it("preview monospace theo lựa chọn đang trỏ", () => {
    const withPreview: DiscoveryQuestion[] = [
      { question: "Bố cục?", options: [{ label: "Lưới", preview: "[ ][ ]" }, { label: "Danh sách", preview: "----" }] },
    ];
    renderWithIntl(<QuestionStepperInput questions={withPreview} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Xem trước lựa chọn")).toHaveTextContent("[ ][ ]");
    fireEvent.mouseEnter(screen.getByRole("radio", { name: /Danh sách/ }));
    expect(screen.getByLabelText("Xem trước lựa chọn")).toHaveTextContent("----");
  });

  it("chưa trả lời gì ⇒ Bỏ qua đóng thẻ (nếu đóng được)", () => {
    const onDismiss = vi.fn();
    renderWithIntl(<QuestionStepperInput questions={[questions[0]]} onSubmit={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("answerValue / formatAnswers", () => {
  it("bỏ đuôi khuyến nghị; câu chọn nhiều gộp cả chữ tự gõ", () => {
    expect(answerValue({ selected: ["Bán xe mới (Khuyến nghị)"], custom: "" }, false)).toBe("Bán xe mới");
    expect(answerValue({ selected: ["Online"], custom: " Zalo " }, true)).toEqual(["Online", "Zalo"]);
    expect(answerValue(undefined, false)).toBeNull();
  });

  it("AI trả lời bằng tiếng Anh (FLF-260) đánh dấu '(Recommended)' - cũng bỏ đuôi khi gửi", () => {
    expect(answerValue({ selected: ["Web app (Recommended)"], custom: "" }, false)).toBe("Web app");
    expect(answerValue({ selected: ["Web app (Recommended)", "Mobile app"], custom: " Kiosk " }, true)).toEqual(["Web app", "Mobile app", "Kiosk"]);
  });

  it("một câu ⇒ nguyên văn; nhiều câu ⇒ dòng `n. ...`, bỏ câu chưa trả lời", () => {
    expect(formatAnswers(["Bán xe mới"])).toBe("Bán xe mới");
    expect(formatAnswers(["Xe cũ", null, ["Online", "Cửa hàng"]])).toBe("1. Xe cũ\n3. Online; Cửa hàng");
  });
});

describe("ElicitPanel - câu mở và câu có lựa chọn", () => {
  const qs = [
    { id: "Q1", text: "Mô tả quy trình đặt lịch?" },
    { id: "Q2", text: "Nền tảng?", options: [{ label: "Web" }, { label: "Mobile" }] },
    { id: "Q3", text: "Ai duyệt lịch?" },
  ];

  it("tách câu mở (ô chat) và câu có lựa chọn (thẻ); option chuỗi cũ vẫn thành thẻ", () => {
    const { card, open } = splitQuestions(qs);
    expect(card.map((q) => q.id)).toEqual(["Q2"]);
    expect(open.map((q) => q.id)).toEqual(["Q1", "Q3"]);
    expect(toDiscoveryQuestion({ id: "Q9", text: "Cũ?", options: ["A", "B"] }).options).toEqual(opts("A", "B"));
  });

  it("chữ gõ ở ô chat trả lời các câu mở theo số trong tin nhắn AI; đoạn tự do ⇒ câu mở đầu", () => {
    expect(directReplyAnswers(qs, "1. Khách chọn giờ\n2. Lễ tân")).toEqual([
      { question_id: "Q1", answer: "Khách chọn giờ" },
      { question_id: "Q3", answer: "Lễ tân" },
    ]);
    expect(directReplyAnswers(qs, " Khách chọn giờ, lễ tân duyệt ")).toEqual([{ question_id: "Q1", answer: "Khách chọn giờ, lễ tân duyệt" }]);
    expect(directReplyAnswers(qs, "   ")).toEqual([]);
  });

  it("không có câu mở ⇒ chữ gõ trả lời câu đầu của thẻ; gộp hai nguồn thì nguồn đầu thắng", () => {
    const onlyCard = [qs[1]];
    expect(directReplyAnswers(onlyCard, "Cả hai")).toEqual([{ question_id: "Q2", answer: "Cả hai" }]);
    expect(toStepAnswers([], "x")).toEqual([]);
    expect(
      mergeAnswers([{ question_id: "Q1", answer: "a" }], [{ question_id: "Q1", answer: "b" }, { question_id: "Q2", answer: "Web" }])
    ).toEqual([
      { question_id: "Q1", answer: "a" },
      { question_id: "Q2", answer: "Web" },
    ]);
  });
});

describe("QuestionStepperInput - thu gọn", () => {
  it("thu gọn còn một dòng câu hỏi, ẩn lựa chọn và nút gửi; mở lại giữ nguyên lựa chọn", () => {
    renderWithIntl(<QuestionStepperInput questions={[questions[0]]} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Xe cũ/ }));

    fireEvent.click(screen.getByRole("button", { name: "Thu gọn câu hỏi" }));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Gửi câu trả lời" })).toBeNull();
    expect(screen.getByText("Mô hình kinh doanh?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mở rộng câu hỏi" }));
    expect(screen.getByRole("radio", { name: /Xe cũ/ }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("question-options", () => {
  it("tin nhắn CHAT cũ (suggestedAnswers) và mới (options object) đọc ra cùng một dạng", () => {
    expect(parseChatQuestion({ question: "Nền tảng?", suggestedAnswers: ["Web", "Mobile"] })?.options).toEqual(opts("Web", "Mobile"));
    expect(parseChatQuestion({ question: "Nền tảng?", header: "Nền tảng", options: [{ label: "Web", description: "Trình duyệt" }] })).toEqual({
      question: "Nền tảng?",
      header: "Nền tảng",
      options: [{ label: "Web", description: "Trình duyệt" }],
      multiple: undefined,
    });
    expect(parseChatQuestion("Kể thêm?")).toEqual({ question: "Kể thêm?", options: [] });
    expect(parseChatQuestion({ nonsense: true })).toBeNull();
  });

  it("tách đuôi khuyến nghị (VI/EN)", () => {
    expect(splitRecommended("99.9% (Khuyến nghị)")).toEqual({ text: "99.9%", recommended: true });
    expect(splitRecommended("Web (Recommended)")).toEqual({ text: "Web", recommended: true });
    expect(splitRecommended("Mobile")).toEqual({ text: "Mobile", recommended: false });
  });
});

describe("FLF-449: thẻ phương án đủ ưu / nhược / rủi ro, khuyến nghị kèm lý do", () => {
  const card: DiscoveryQuestion = {
    question: "Kênh nhắc lịch nào?",
    header: "Nhắc lịch",
    recommendation_reason: "Bạn nói bệnh nhân lớn tuổi ít dùng ứng dụng",
    options: [
      { label: "SMS (Khuyến nghị)", recommended: true, pros: ["Ai cũng nhận được"], cons: ["Tốn phí mỗi tin"], risks: ["Giả định số điện thoại đúng"] },
      { label: "Zalo", pros: ["Miễn phí"] },
      { label: "Email" },
    ],
    multiple: false,
  };

  it("khối Vì sao khuyến nghị chỉ ở phương án được khuyến nghị; ưu / nhược thu gọn mặc định, bấm mới mở", () => {
    renderWithIntl(<QuestionStepperInput questions={[card]} onSubmit={vi.fn()} />);
    expect(screen.getAllByText("Vì sao khuyến nghị:")).toHaveLength(1);
    expect(screen.getByText("Bạn nói bệnh nhân lớn tuổi ít dùng ứng dụng")).toBeInTheDocument();

    // Thu gọn mặc định: chưa thấy ưu / nhược; phương án không có phân tích thì không có nút
    expect(screen.queryByText("Tốn phí mỗi tin")).toBeNull();
    const toggles = screen.getAllByRole("button", { name: "Xem ưu, nhược" });
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    expect(screen.getByRole("button", { name: "Ẩn ưu, nhược" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Ai cũng nhận được")).toBeInTheDocument();
    expect(screen.getByText("Tốn phí mỗi tin")).toBeInTheDocument();
    expect(screen.getByText("Giả định số điện thoại đúng")).toBeInTheDocument();
    expect(screen.getByText("Rủi ro, giả định")).toBeInTheDocument();
  });

  it("mở ưu / nhược không chọn phương án; chọn vẫn gửi nhãn không kèm đuôi", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<QuestionStepperInput questions={[card]} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Xem ưu, nhược" })[0]);
    expect(screen.getByRole("radio", { name: /SMS/ })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: /SMS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));
    expect(onSubmit).toHaveBeenCalledWith(["SMS"]);
  });

  it("cờ recommended không kèm đuôi vẫn hiện badge; không khuyến nghị thì không có khối lý do", () => {
    const flagOnly: DiscoveryQuestion = { ...card, options: [{ label: "SMS", recommended: true }, { label: "Zalo" }] };
    const { unmount } = renderWithIntl(<QuestionStepperInput questions={[flagOnly]} onSubmit={vi.fn()} />);
    expect(screen.getByText("Khuyến nghị")).toBeInTheDocument();
    unmount();
    const neutral: DiscoveryQuestion = { ...card, options: [{ label: "SMS" }, { label: "Zalo" }] };
    renderWithIntl(<QuestionStepperInput questions={[neutral]} onSubmit={vi.fn()} />);
    expect(screen.queryByText("Khuyến nghị")).toBeNull();
    expect(screen.queryByText("Vì sao khuyến nghị:")).toBeNull();
  });

  it("parseChatQuestion / toDiscoveryQuestion giữ ưu / nhược / rủi ro, cờ và lý do khuyến nghị", () => {
    const raw = {
      question: "Kênh nhắc lịch nào?",
      recommendation_reason: "Bệnh nhân lớn tuổi",
      options: [{ label: "SMS (Khuyến nghị)", recommended: true, pros: ["Ai cũng nhận", "", 3], cons: ["Tốn phí"], risks: "không phải mảng" }, { label: "Zalo" }],
    };
    expect(parseChatQuestion(raw)).toEqual({
      question: "Kênh nhắc lịch nào?",
      options: [{ label: "SMS (Khuyến nghị)", recommended: true, pros: ["Ai cũng nhận"], cons: ["Tốn phí"] }, { label: "Zalo" }],
      multiple: undefined,
      recommendation_reason: "Bệnh nhân lớn tuổi",
    });
    const step = toDiscoveryQuestion({ id: "Q_reminder", text: "Kênh?", recommendation_reason: "r", options: [{ label: "SMS", recommended: true, cons: ["Tốn phí"] }, "Zalo"] });
    expect(step.recommendation_reason).toBe("r");
    expect(step.options).toEqual([{ label: "SMS", recommended: true, cons: ["Tốn phí"] }, { label: "Zalo" }]);
  });

  it("isRecommendedOption: cờ mới hoặc đuôi cũ", () => {
    expect(isRecommendedOption({ label: "Web (Khuyến nghị)" })).toBe(true);
    expect(isRecommendedOption({ label: "Web", recommended: true })).toBe(true);
    expect(isRecommendedOption({ label: "Web" })).toBe(false);
  });
});
