"use client";

import type { Question, StepAnswer } from "@/types/pipeline";
import QuestionStepperInput from "./QuestionStepperInput";

interface ElicitPanelProps {
  questions: Question[];
  onSubmit: (answers: StepAnswer[]) => void;
  onDismiss?: () => void;
  sending?: boolean;
}

/**
 * `QuestionStepperInput` gửi một chuỗi: 1 câu ⇒ câu trả lời; nhiều câu ⇒ các dòng `n. câu trả lời`.
 * Tách lại theo thứ tự câu hỏi thành `answers[]` của `POST /steps/:id/answer`.
 */
export const toStepAnswers = (questions: Question[], text: string): StepAnswer[] => {
  if (questions.length === 1) return [{ question_id: questions[0].id, answer: text.trim() }];
  const byIndex = new Map<number, string>();
  for (const line of text.split("\n")) {
    const match = /^(\d+)\.\s+([\s\S]*)$/.exec(line.trim());
    if (match) byIndex.set(Number(match[1]) - 1, match[2].trim());
  }
  return questions.flatMap((q, i) => {
    const answer = byIndex.get(i);
    return answer ? [{ question_id: q.id, answer }] : [];
  });
};

export default function ElicitPanel({ questions, onSubmit, onDismiss, sending = false }: ElicitPanelProps) {
  if (questions.length === 0) return null;
  return (
    <QuestionStepperInput
      key={questions.map((q) => q.id).join("|")}
      questions={questions.map((q) => ({ question: q.text, suggestedAnswers: q.options ?? [], multiple: q.multiple }))}
      onSendAnswers={(text) => {
        const answers = toStepAnswers(questions, text);
        if (answers.length > 0) onSubmit(answers);
      }}
      onDismiss={onDismiss ?? (() => undefined)}
      sending={sending}
    />
  );
}
