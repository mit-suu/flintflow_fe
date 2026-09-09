"use client";

import { useState } from "react";
import { DiscoveryQuestion } from "../../../../lib/constants/section-types";

interface QuestionStepperInputProps {
  questions: DiscoveryQuestion[];
  onSendAnswers: (answersText: string) => void;
  onDismiss: () => void;
  sending?: boolean;
}

export const isQuestionMultiple = (q?: DiscoveryQuestion): boolean => {
  if (!q) return false;
  if (typeof q.multiple === "boolean") return q.multiple;
  const lower = (q.question || "").toLowerCase();
  const multiKeywords = [
    "những",
    "các",
    "liệt kê",
    "bao gồm",
    "tính năng nào",
    "nào dưới đây",
    "danh sách",
    "kênh nào",
    "rủi ro nào",
    "nhóm nào",
    "đối tượng nào",
  ];
  return multiKeywords.some((kw) => lower.includes(kw));
};

export default function QuestionStepperInput({
  questions,
  onSendAnswers,
  onDismiss,
  sending = false,
}: QuestionStepperInputProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, string[]>
  >({});
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});

  const totalQuestions = questions.length;
  const clampedIndex = Math.min(
    Math.max(0, currentIndex),
    Math.max(0, totalQuestions - 1)
  );
  const currentQ = questions[clampedIndex];
  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === totalQuestions - 1;

  if (!currentQ || totalQuestions === 0) return null;

  const isMultiple = isQuestionMultiple(currentQ);

  const handleToggleOption = (qIdx: number, option: string) => {
    const isMulti = isQuestionMultiple(questions[qIdx]);
    setSelectedOptions((prev) => {
      const currentList = prev[qIdx] || [];
      if (isMulti) {
        const isAlreadySelected = currentList.includes(option);
        const nextList = isAlreadySelected
          ? currentList.filter((item) => item !== option)
          : [...currentList, option];
        return { ...prev, [qIdx]: nextList };
      } else {
        const isAlreadySelected = currentList.includes(option);
        return {
          ...prev,
          [qIdx]: isAlreadySelected ? [] : [option],
        };
      }
    });
    // NOTE: NEVER modify customAnswers[qIdx] here!
  };

  const handleCustomChange = (qIdx: number, val: string) => {
    setCustomAnswers((prev) => ({ ...prev, [qIdx]: val }));
  };

  const isQuestionAnswered = (qIdx: number) => {
    const opts = selectedOptions[qIdx] || [];
    const custom = (customAnswers[qIdx] || "").trim();
    return opts.length > 0 || custom.length > 0;
  };

  const answeredCount = questions.filter((_, idx) => isQuestionAnswered(idx)).length;
  const hasAnyAnswer = answeredCount > 0;

  const buildAnswerTextForQuestion = (qIdx: number): string => {
    const opts = selectedOptions[qIdx] || [];
    const custom = (customAnswers[qIdx] || "").trim();

    if (opts.length > 0 && custom.length > 0) {
      return `${opts.join("; ")} (Bổ sung: ${custom})`;
    }
    if (opts.length > 0) {
      return opts.join("; ");
    }
    if (custom.length > 0) {
      return custom;
    }
    return "";
  };

  const handleNextOrSubmit = () => {
    if (!isLast) {
      setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
    } else {
      if (!hasAnyAnswer || sending) return;

      let formattedText = "";
      if (totalQuestions === 1) {
        formattedText = buildAnswerTextForQuestion(0);
      } else {
        const lines: string[] = [];
        questions.forEach((_, idx) => {
          const ans = buildAnswerTextForQuestion(idx);
          if (ans) {
            lines.push(`${idx + 1}. ${ans}`);
          }
        });
        formattedText = lines.join("\n");
      }

      onSendAnswers(formattedText);
      setSelectedOptions({});
      setCustomAnswers({});
      setCurrentIndex(0);
    }
  };

  const hasSuggestions =
    currentQ.suggestedAnswers && currentQ.suggestedAnswers.length > 0;
  const currentSelectedList = selectedOptions[clampedIndex] || [];

  return (
    <div className="p-3.5 bg-white border-t border-[#ECEAE5] shrink-0 flex flex-col gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
      {/* Stepper Card */}
      <div className="border border-[#DDD9F6] bg-[#FAF9F7] rounded-[14px] p-3.5 flex flex-col gap-3">
        {/* Header: Question Counter & Step Indicator */}
        <div className="flex items-center justify-between pb-2 border-b border-[#ECEAE5]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] font-extrabold text-[11px] flex items-center justify-center">
              ✦
            </span>
            <span className="text-[11.5px] font-extrabold text-[#4F46E5] uppercase tracking-wider">
              Câu hỏi {clampedIndex + 1} / {totalQuestions}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isMultiple
                  ? "bg-[#EEF2FF] text-[#4F46E5] border-[#DDD9F6]"
                  : "bg-[#F5F3F0] text-[#6B6862] border-[#E4E1DC]"
              }`}
            >
              {isMultiple ? "✦ Chọn nhiều" : "◉ Chọn 1"}
            </span>
            <span className="text-[11px] text-[#8A867E]">
              ({answeredCount}/{totalQuestions})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick jump step pills */}
            {totalQuestions > 1 && (
              <div className="flex items-center gap-1">
                {questions.map((_, idx) => {
                  const isDone = isQuestionAnswered(idx);
                  const isCurrent = idx === clampedIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-5.5 h-5.5 rounded-full text-[10.5px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-[#4F46E5] text-white shadow-xs"
                          : isDone
                          ? "bg-[#E0E7FF] text-[#4338CA]"
                          : "bg-white border border-[#E5E3DF] text-[#8A867E] hover:bg-[#F0EEEA]"
                      }`}
                      title={`Câu ${idx + 1}`}
                    >
                      {isDone && !isCurrent ? "✓" : idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Close / Dismiss button */}
            <button
              type="button"
              onClick={onDismiss}
              className="w-5.5 h-5.5 rounded-full text-[#8A867E] hover:text-[#191817] hover:bg-[#E5E3DF] flex items-center justify-center text-xs transition-all cursor-pointer ml-1"
              title="Đóng / Gõ tự do"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div className="text-[13px] font-bold text-[#191817] leading-relaxed">
          {currentQ.question}
        </div>

        {/* Suggested Answers Options (Multi-select Checkboxes OR Single-select Radio) */}
        {hasSuggestions && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#6B6862]">
              {isMultiple
                ? "Gợi ý câu trả lời mẫu (chọn 1 hoặc nhiều đáp án):"
                : "Gợi ý câu trả lời mẫu (chọn 1 đáp án phù hợp nhất):"}
            </span>
            <div className="flex flex-col gap-1.5">
              {currentQ.suggestedAnswers.map((suggestion, sIdx) => {
                const isSelected = currentSelectedList.includes(suggestion);

                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() =>
                      handleToggleOption(clampedIndex, suggestion)
                    }
                    className={`w-full px-3 py-2 rounded-[10px] text-left text-[12px] flex items-start gap-2.5 transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#EEF2FF] text-[#312E81] border-[#6366F1] shadow-2xs font-semibold"
                        : "bg-white hover:bg-[#F4F3FE] text-[#33312D] border-[#ECEAE5] hover:border-[#DDD9F6]"
                    }`}
                  >
                    {/* Selection Indicator: Checkbox if multi, Radio if single */}
                    {isMultiple ? (
                      <div
                        className={`w-4.5 h-4.5 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          isSelected
                            ? "bg-[#4F46E5] text-white shadow-2xs"
                            : "border-2 border-[#C7C4BE] bg-white hover:border-[#4F46E5]"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          isSelected
                            ? "border-2 border-[#4F46E5] bg-white shadow-2xs"
                            : "border-2 border-[#C7C4BE] bg-white hover:border-[#4F46E5]"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#4F46E5]" />
                        )}
                      </div>
                    )}
                    <span className="leading-relaxed flex-1">{suggestion}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Input Field (Separate & Independent) */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#6B6862]">
            Phần tự trả lời của bạn:
          </span>
          <textarea
            rows={2}
            value={customAnswers[clampedIndex] || ""}
            onChange={(e) => handleCustomChange(clampedIndex, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleNextOrSubmit();
              }
            }}
            placeholder={
              hasSuggestions
                ? "Nhập câu trả lời riêng hoặc bổ sung chi tiết..."
                : "Nhập câu trả lời của bạn..."
            }
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]/20 rounded-[10px] text-[12px] text-[#191817] placeholder:text-[#A8A49C] outline-none transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Navigation Actions Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {currentSelectedList.length > 0 && (
              <span className="text-[11px] font-semibold text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded-full border border-[#DDD9F6]">
                {currentSelectedList.length} đã chọn
              </span>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11.5px] font-semibold text-[#8A867E] hover:text-[#191817] hover:underline transition-colors cursor-pointer"
            >
              Bỏ qua (gõ tự do)
            </button>
            {!isFirst && (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-full text-[11.5px] font-bold text-[#6B6862] hover:text-[#191817] bg-[#F0EEEA] hover:bg-[#E5E3DF] flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>←</span> Quay lại
              </button>
            )}
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={handleNextOrSubmit}
              className="px-4 py-1.5 rounded-full text-[12px] font-bold bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <span>Tiếp tục</span>
              <span>→</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextOrSubmit}
              disabled={!hasAnyAnswer || sending}
              className={`px-5 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                hasAnyAnswer && !sending
                  ? "bg-[#4F46E5] hover:bg-[#4338CA] text-white cursor-pointer active:scale-98"
                  : "bg-[#E5E3DF] text-[#A8A49C] cursor-not-allowed"
              }`}
            >
              {sending ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Gửi câu trả lời</span>
                  <span className="text-[13px] font-bold">↵</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
