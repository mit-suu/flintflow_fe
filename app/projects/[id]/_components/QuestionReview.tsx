"use client";

import Icon from "@/components/ui/Icon";
import type { DiscoveryQuestion } from "@/types/chat";

interface QuestionReviewProps {
  questions: DiscoveryQuestion[];
  /** Câu trả lời theo chỉ số câu; `null` là chưa trả lời. */
  values: (string | string[] | null)[];
  /** Bấm vào một câu để quay lại sửa. */
  onEdit: (index: number) => void;
}

/** Tab "Xem lại" của thẻ hỏi: mỗi câu một dòng kèm đáp án, bấm để sửa. */
export default function QuestionReview({ questions, values, onEdit }: QuestionReviewProps) {
  return (
    <ul className="flex flex-col gap-0.5 px-0.5 pt-1" aria-label="Câu trả lời của bạn">
      {questions.map((q, i) => {
        const value = values[i];
        const text = Array.isArray(value) ? value.join("; ") : value;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-control text-left hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[11.5px] text-on-surface-muted leading-snug">{q.question}</span>
                {text ? (
                  <span className="text-[12.5px] font-semibold text-on-surface leading-snug">{text}</span>
                ) : (
                  <span className="text-[12px] italic text-on-surface-subtle leading-snug">Chưa trả lời — AI sẽ tự giả định</span>
                )}
              </span>
              <Icon name="pencil" size={12} className="shrink-0 mt-1 text-on-surface-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
