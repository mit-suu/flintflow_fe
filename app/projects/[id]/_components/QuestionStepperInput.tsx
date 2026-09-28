"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DiscoveryQuestion } from "@/types/chat";
import Icon from "@/components/ui/Icon";
import { splitRecommended, stripRecommended } from "@/lib/question-options";
import QuestionOptionRow from "./QuestionOptionRow";
import QuestionReview from "./QuestionReview";

/** Câu trả lời của một câu trên thẻ: lựa chọn (nhãn gốc) + chữ tự gõ ở dòng "Khác…". */
export interface CardAnswer {
  selected: string[];
  custom: string;
}

interface QuestionStepperInputProps {
  /** Chỉ câu CÓ lựa chọn — câu mở trả lời bằng ô chat. */
  questions: DiscoveryQuestion[];
  /** Mỗi phần tử ứng với câu cùng chỉ số; câu chưa trả lời là `null`. */
  onSubmit: (answers: (string | string[] | null)[]) => void;
  /** Báo câu trả lời đang có mỗi lần đổi — để ô chat gửi kèm phần đã chọn. */
  onChange?: (answers: (string | string[] | null)[]) => void;
  /** Không truyền ⇒ ẩn nút đóng (vd. step đang chờ trả lời, không bỏ ngang được). */
  onDismiss?: () => void;
  sending?: boolean;
}

const EMPTY: CardAnswer = { selected: [], custom: "" };

/** Câu trả lời gửi đi: nhãn bỏ đuôi "(Khuyến nghị)"; câu chọn nhiều giữ mảng. */
export const answerValue = (answer: CardAnswer | undefined, multiple: boolean): string | string[] | null => {
  const picked = (answer?.selected ?? []).map(stripRecommended);
  const own = (answer?.custom ?? "").trim();
  if (multiple) {
    const all = own ? [...picked, own] : picked;
    return all.length > 0 ? all : null;
  }
  return picked[0] ?? (own || null);
};

/** Chuỗi hiển thị của một câu trả lời (màn xem lại, tin nhắn chat). */
export const answerLabel = (value: string | string[] | null): string => (Array.isArray(value) ? value.join("; ") : (value ?? ""));

/**
 * Chat Discovery gửi một tin nhắn: 1 câu ⇒ câu trả lời; nhiều câu ⇒ các dòng `n. câu trả lời`, bỏ câu chưa trả lời.
 */
export const formatAnswers = (answers: (string | string[] | null)[]): string => {
  if (answers.length === 1) return answerLabel(answers[0]);
  return answers.flatMap((a, i) => (a === null ? [] : [`${i + 1}. ${answerLabel(a)}`])).join("\n");
};

/**
 * Thẻ hỏi kiểu AskUserQuestion: hàng tab theo `header`, lựa chọn đánh số kèm mô tả, dòng "Khác…" luôn có,
 * `preview` monospace cạnh danh sách, tab "Xem lại" trước khi gửi. Câu chọn 1: chọn xong tự sang câu kế.
 */
export default function QuestionStepperInput({ questions, onSubmit, onChange, onDismiss, sending = false }: QuestionStepperInputProps) {
  // Bộ câu hỏi mới được mount lại qua `key`, nên state tự reset — không cần effect.
  const [tab, setTab] = useState(0);
  const [answers, setAnswers] = useState<Record<number, CardAnswer>>({});
  const [focusedOption, setFocusedOption] = useState<number | null>(null);
  /** Thu gọn thẻ còn một dòng (tab + câu hỏi) để đọc lại hội thoại phía trên; câu trả lời đã chọn vẫn giữ. */
  const [collapsed, setCollapsed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  // Đặt focus vào thẻ để phím số / mũi tên dùng được ngay, không cuộn trang
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  const total = questions.length;
  if (total === 0) return null;

  const hasReview = total > 1;
  const lastTab = hasReview ? total : total - 1;
  const current = Math.min(Math.max(0, tab), lastTab);
  const onReview = hasReview && current === total;
  const question = onReview ? undefined : questions[current];
  const isMultiple = Boolean(question?.multiple);
  const options = question?.options ?? [];
  const answer = answers[current] ?? EMPTY;

  const values = questions.map((q, i) => answerValue(answers[i], Boolean(q.multiple)));
  const isAnswered = (i: number) => values[i] !== null;
  const hasAnyAnswer = values.some((v) => v !== null);

  const update = (index: number, next: CardAnswer) => {
    const merged = { ...answers, [index]: next };
    setAnswers(merged);
    onChange?.(questions.map((q, i) => answerValue(merged[i], Boolean(q.multiple))));
  };

  const goTo = (index: number) => {
    setTab(Math.min(lastTab, Math.max(0, index)));
    setFocusedOption(null);
  };

  const submit = () => {
    if (!hasAnyAnswer || sending) return;
    onSubmit(values);
  };

  const next = () => (current === lastTab ? submit() : goTo(current + 1));

  const toggleOption = (label: string) => {
    const already = answer.selected.includes(label);
    if (isMultiple) {
      update(current, { ...answer, selected: already ? answer.selected.filter((o) => o !== label) : [...answer.selected, label] });
      return;
    }
    // Câu chọn 1: chọn lựa chọn thì bỏ chữ "Khác…" đã gõ; chọn xong tự sang câu kế
    update(current, { selected: already ? [] : [label], custom: "" });
    if (!already && current < lastTab) goTo(current + 1);
  };

  const setCustom = (text: string) =>
    update(current, isMultiple ? { ...answer, custom: text } : { selected: text.trim() ? [] : answer.selected, custom: text });

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Đang gõ trong ô "Khác…" ⇒ để ô đó tự xử lý phím
    if (e.target instanceof HTMLInputElement) return;
    const digit = Number(e.key);
    if (!onReview && Number.isInteger(digit) && digit >= 1 && digit <= options.length) {
      e.preventDefault();
      toggleOption(options[digit - 1].label);
    } else if (!onReview && digit === options.length + 1) {
      e.preventDefault();
      otherRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      next();
    } else if (e.key === "Escape" && onDismiss) {
      e.preventDefault();
      onDismiss();
    }
  };

  // Preview theo lựa chọn đang trỏ (hover/focus), không thì lựa chọn đã chọn, không thì lựa chọn đầu
  const hasPreview = options.some((o) => o.preview);
  const previewIndex = focusedOption ?? Math.max(0, options.findIndex((o) => answer.selected.includes(o.label)));
  const preview = hasPreview ? options[previewIndex]?.preview : undefined;

  const isSubmitTab = current === lastTab;
  const actionLabel = isSubmitTab ? "Gửi câu trả lời" : isAnswered(current) ? "Tiếp" : "Bỏ qua";

  return (
    // Đứng một mình thì chừa đáy; có ô chat ngay sau (ChatPane) thì để ô chat lo khoảng cách
    <div className="px-4 pt-2 pb-4 [&:has(+*)]:pb-0">
      <div
        ref={cardRef}
        tabIndex={-1}
        role="group"
        aria-label={onReview ? "Xem lại câu trả lời" : `Câu hỏi ${current + 1} trên ${total}`}
        onKeyDown={handleCardKeyDown}
        className="@container rounded-card bg-surface-container-lowest p-2 flex flex-col gap-0.5 outline-none"
      >
        {/* Hàng tab: mỗi câu một tab theo header, tab cuối "Xem lại" · đóng */}
        <div className="flex items-center gap-1 pl-1 pr-1 pt-0.5">
          <div role="tablist" aria-label="Các câu hỏi" className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto ff-scroll">
            {total > 1 &&
              questions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === current}
                  onClick={() => goTo(i)}
                  className={`h-6 px-2 shrink-0 rounded-inner flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    i === current ? "bg-primary-soft text-primary-hover" : "text-on-surface-muted hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  {isAnswered(i) && <Icon name="check" size={11} weight="bold" />}
                  {q.header ?? `Câu ${i + 1}`}
                </button>
              ))}
            {hasReview && (
              <button
                type="button"
                role="tab"
                aria-selected={onReview}
                onClick={() => goTo(total)}
                className={`h-6 px-2 shrink-0 rounded-inner text-[11px] font-bold transition-colors cursor-pointer ${
                  onReview ? "bg-primary-soft text-primary-hover" : "text-on-surface-muted hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                Xem lại
              </button>
            )}
            {total === 1 && question?.header && (
              <span className="h-6 px-2 shrink-0 rounded-inner bg-primary-soft text-primary-hover flex items-center text-[11px] font-bold">
                {question.header}
              </span>
            )}
          </div>
          {collapsed && question && (
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-on-surface" title={question.question}>
              {question.question}
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Mở rộng câu hỏi" : "Thu gọn câu hỏi"}
            title={collapsed ? "Mở rộng" : "Thu gọn"}
            className="w-6 h-6 shrink-0 grid place-items-center rounded-inner text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors"
          >
            <Icon name={collapsed ? "chevron-up" : "chevron-down"} size={14} />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Đóng câu hỏi"
              title="Đóng (Esc)"
              className="w-6 h-6 shrink-0 grid place-items-center rounded-inner text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {collapsed ? null : onReview ? (
          <QuestionReview questions={questions} values={values} onEdit={goTo} />
        ) : (
          question && (
            <>
              <div className="flex flex-col gap-0.5 px-2 pt-0.5 pb-0.5">
                <p className="text-[12.5px] font-bold text-on-surface leading-snug">{question.question}</p>
                {isMultiple && <span className="text-[11px] text-on-surface-muted">Chọn một hoặc nhiều đáp án</span>}
              </div>

              <div className={`grid gap-2 ${preview !== undefined ? "@[560px]:grid-cols-2" : ""}`}>
                <div
                  className="flex flex-col gap-0.5 min-w-0"
                  role={isMultiple ? "group" : "radiogroup"}
                  aria-label="Lựa chọn"
                  onMouseLeave={() => setFocusedOption(null)}
                >
                  {options.map((option, oIdx) => {
                    const { text, recommended } = splitRecommended(option.label);
                    return (
                      <QuestionOptionRow
                        key={oIdx}
                        index={oIdx}
                        label={text}
                        description={option.description}
                        recommended={recommended}
                        selected={answer.selected.includes(option.label)}
                        multiple={isMultiple}
                        onToggle={() => toggleOption(option.label)}
                        onFocus={() => setFocusedOption(oIdx)}
                      />
                    );
                  })}

                  {/* "Khác…": luôn có, gõ tự do */}
                  <label className="flex items-center gap-2 px-2 py-1 rounded-control hover:bg-surface-container transition-colors cursor-text">
                    <span
                      aria-hidden
                      className={`w-5 h-5 shrink-0 grid place-items-center rounded-inner text-[10.5px] font-bold tabular-nums ${
                        answer.custom.trim() ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
                      }`}
                    >
                      {options.length + 1}
                    </span>
                    <input
                      ref={otherRef}
                      type="text"
                      value={answer.custom}
                      onChange={(e) => setCustom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          next();
                        } else if (e.key === "Escape") {
                          cardRef.current?.focus({ preventScroll: true });
                        }
                      }}
                      aria-label="Câu trả lời khác"
                      placeholder="Khác…"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-on-surface placeholder:text-on-surface-subtle"
                    />
                  </label>
                </div>

                {preview !== undefined && (
                  <pre
                    aria-label="Xem trước lựa chọn"
                    className="m-0 min-w-0 overflow-x-auto ff-scroll rounded-control bg-surface-container px-3 py-2 font-mono text-[11px] leading-snug text-on-surface whitespace-pre"
                  >
                    {preview}
                  </pre>
                )}
              </div>
            </>
          )
        )}

        {/* Hành động */}
        <div hidden={collapsed} className={`${collapsed ? "hidden" : "flex"} items-center justify-end gap-2 px-1 pt-0.5 pb-0.5`}>
          {isSubmitTab && !hasAnyAnswer && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="h-7 px-3 shrink-0 rounded-control text-[11.5px] font-bold bg-surface-container text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              Bỏ qua
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={isSubmitTab && (!hasAnyAnswer || sending)}
            className={`h-7 px-3 shrink-0 rounded-control text-[11.5px] font-bold flex items-center gap-1.5 transition-colors ${
              isSubmitTab
                ? "bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-container-highest disabled:text-on-surface-subtle"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            } cursor-pointer disabled:cursor-not-allowed`}
          >
            {sending && isSubmitTab ? (
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
