"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DiscoveryQuestion } from "@/types/chat";
import Icon from "@/components/ui/Icon";

interface QuestionStepperInputProps {
  questions: DiscoveryQuestion[];
  onSendAnswers: (answersText: string) => void;
  /** Không truyền ⇒ ẩn nút đóng (vd. step đang chờ trả lời, không bỏ ngang được). */
  onDismiss?: () => void;
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

/**
 * Chuỗi gửi đi: 1 câu ⇒ câu trả lời; nhiều câu ⇒ các dòng `n. câu trả lời` (bỏ câu chưa trả lời).
 * `ElicitPanel.toStepAnswers` tách ngược lại theo đúng định dạng này.
 */
export const formatAnswers = (
  questionCount: number,
  selected: Record<number, string[]>,
  custom: Record<number, string>
): string => {
  const answerOf = (idx: number): string => {
    const opts = selected[idx] ?? [];
    const own = (custom[idx] ?? "").trim();
    if (opts.length > 0 && own) return `${opts.join("; ")} (Bổ sung: ${own})`;
    return opts.length > 0 ? opts.join("; ") : own;
  };
  if (questionCount === 1) return answerOf(0);
  return Array.from({ length: questionCount }, (_, idx) => answerOf(idx))
    .flatMap((ans, idx) => (ans ? [`${idx + 1}. ${ans}`] : []))
    .join("\n");
};

/**
 * Thẻ câu hỏi có gợi ý: một câu mỗi lúc, lựa chọn đánh số (bấm phím số để chọn), dòng cuối để tự trả lời.
 * Chọn một đáp án (câu chọn 1) tự sang câu kế; câu cuối gửi toàn bộ.
 */
export default function QuestionStepperInput({
  questions,
  onSendAnswers,
  onDismiss,
  sending = false,
}: QuestionStepperInputProps) {
  // Bộ câu hỏi mới được mount lại qua `key`, nên state tự reset — không cần effect.
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  // Đặt focus vào thẻ để phím số / mũi tên dùng được ngay, không cuộn trang
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  const total = questions.length;
  const index = Math.min(Math.max(0, currentIndex), Math.max(0, total - 1));
  const current = questions[index];
  if (!current || total === 0) return null;

  const isLast = index === total - 1;
  const isMultiple = isQuestionMultiple(current);
  const options = current.suggestedAnswers ?? [];
  const selected = selectedOptions[index] ?? [];

  const isAnswered = (idx: number) =>
    (selectedOptions[idx] ?? []).length > 0 || (customAnswers[idx] ?? "").trim().length > 0;
  const hasAnyAnswer = questions.some((_, idx) => isAnswered(idx));

  const goTo = (idx: number) => setCurrentIndex(Math.min(total - 1, Math.max(0, idx)));

  const submit = () => {
    if (!hasAnyAnswer || sending) return;
    onSendAnswers(formatAnswers(total, selectedOptions, customAnswers));
  };

  const next = () => (isLast ? submit() : goTo(index + 1));

  const toggleOption = (option: string) => {
    const already = selected.includes(option);
    const nextList = isMultiple
      ? already
        ? selected.filter((o) => o !== option)
        : [...selected, option]
      : already
        ? []
        : [option];
    setSelectedOptions((prev) => ({ ...prev, [index]: nextList }));
    // Câu chọn 1: chọn xong tự sang câu kế cho nhanh
    if (!isMultiple && !already && !isLast) goTo(index + 1);
  };

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Đang gõ trong ô tự trả lời ⇒ để ô đó tự xử lý phím
    if (e.target instanceof HTMLInputElement) return;
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= options.length) {
      e.preventDefault();
      toggleOption(options[digit - 1]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      next();
    } else if (e.key === "Escape" && onDismiss) {
      e.preventDefault();
      onDismiss();
    }
  };

  // Nút cuối hàng tự trả lời: câu chưa cuối ⇒ Bỏ qua / Tiếp; câu cuối ⇒ Gửi
  const actionLabel = isLast ? "Gửi câu trả lời" : isAnswered(index) ? "Tiếp" : "Bỏ qua";
  const actionDisabled = isLast && (!hasAnyAnswer || sending);
  // Câu cuối chưa trả lời vẫn bỏ qua được: đã có câu trả lời khác ⇒ gửi phần đã có; chưa có gì ⇒ đóng thẻ (nếu được)
  const canSkipLast = isLast && !isAnswered(index) && !sending && (hasAnyAnswer || Boolean(onDismiss));
  const skipLast = () => (hasAnyAnswer ? submit() : onDismiss?.());

  return (
    // Đứng một mình thì chừa đáy; có ô chat ngay sau (ChatPane) thì để ô chat lo khoảng cách
    <div className="px-4 pt-2 pb-4 [&:has(+*)]:pb-0">
      <div
        ref={cardRef}
        tabIndex={-1}
        role="group"
        aria-label={`Câu hỏi ${index + 1} trên ${total}`}
        onKeyDown={handleCardKeyDown}
        className="rounded-card bg-surface-container-lowest p-2 flex flex-col gap-1 outline-none"
      >
        {/* Header: câu hỏi · điều hướng · đóng */}
        <div className="flex items-start gap-3 pl-2 pr-1 pt-1.5 pb-1">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-[13px] font-bold text-on-surface leading-relaxed">{current.question}</p>
            {isMultiple && options.length > 0 && (
              <span className="text-[11px] text-on-surface-muted">Chọn một hoặc nhiều đáp án</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 text-on-surface-muted">
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  aria-label="Câu trước"
                  className="w-6 h-6 grid place-items-center rounded-inner hover:bg-surface-container-high hover:text-on-surface disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default transition-colors"
                >
                  <Icon name="caret-left" size={14} />
                </button>
                <span className="text-[11.5px] font-semibold tabular-nums px-0.5">
                  {index + 1} / {total}
                </span>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  disabled={isLast}
                  aria-label="Câu sau"
                  className="w-6 h-6 grid place-items-center rounded-inner hover:bg-surface-container-high hover:text-on-surface disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default transition-colors"
                >
                  <Icon name="caret-right" size={14} />
                </button>
              </>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Đóng câu hỏi"
                title="Đóng (Esc)"
                className="w-6 h-6 ml-1 grid place-items-center rounded-inner hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lựa chọn đánh số — nền phẳng, dòng đang chọn tô tím nhạt */}
        {options.length > 0 && (
          <div className="flex flex-col gap-0.5" role={isMultiple ? "group" : "radiogroup"} aria-label="Gợi ý trả lời">
            {options.map((option, oIdx) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={oIdx}
                  type="button"
                  role={isMultiple ? "checkbox" : "radio"}
                  aria-checked={isSelected}
                  onClick={() => toggleOption(option)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-control text-left text-[12.5px] leading-relaxed transition-colors cursor-pointer ${
                    isSelected ? "bg-primary-soft text-primary-hover font-semibold" : "text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`w-6 h-6 shrink-0 grid place-items-center rounded-inner text-[11px] font-bold tabular-nums transition-colors ${
                      isSelected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
                    }`}
                  >
                    {isSelected && isMultiple ? <Icon name="check" size={12} weight="bold" /> : oIdx + 1}
                  </span>
                  <span className="flex-1 min-w-0">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dòng tự trả lời + hành động */}
        <div className="flex items-center gap-2.5 pl-2 pr-1 py-1">
          <span aria-hidden className="w-6 h-6 shrink-0 grid place-items-center rounded-inner bg-surface-container text-on-surface-muted">
            <Icon name="pencil" size={12} />
          </span>
          <input
            type="text"
            value={customAnswers[index] ?? ""}
            onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                next();
              } else if (e.key === "Escape") {
                cardRef.current?.focus({ preventScroll: true });
              }
            }}
            aria-label="Câu trả lời khác"
            placeholder={options.length > 0 ? "Câu trả lời khác…" : "Nhập câu trả lời của bạn…"}
            className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-on-surface placeholder:text-on-surface-subtle py-1"
          />
          {canSkipLast && (
            <button
              type="button"
              onClick={skipLast}
              className="h-7 px-3 shrink-0 rounded-control text-[11.5px] font-bold bg-surface-container text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              Bỏ qua
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={actionDisabled}
            className={`h-7 px-3 shrink-0 rounded-control text-[11.5px] font-bold flex items-center gap-1.5 transition-colors ${
              isLast
                ? "bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-container-highest disabled:text-on-surface-subtle"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            } cursor-pointer disabled:cursor-not-allowed`}
          >
            {sending && isLast ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner" aria-label="Đang gửi" />
            ) : (
              actionLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
