"use client";

import type { Question, StepAnswer } from "@/types/pipeline";
import { replyContainsQuestion, toDiscoveryQuestion } from "@/lib/question-options";
import QuestionStepperInput from "./QuestionStepperInput";

interface ElicitPanelProps {
  questions: Question[];
  onSubmit: (answers: StepAnswer[]) => void;
  /** Chữ đang gõ ở ô chat — nút Gửi của thẻ gửi kèm làm câu trả lời cho câu mở. */
  chatDraft?: string;
  /** Gọi sau khi đã gửi kèm `chatDraft` để ô chat xoá chữ. */
  onChatDraftUsed?: () => void;
  /** Câu trả lời đang chọn trên thẻ — để ô chat gửi kèm khi user bấm Enter ở ô chat. */
  onCardChange?: (answers: StepAnswer[]) => void;
  onDismiss?: () => void;
  sending?: boolean;
}

const hasOptions = (q: Question): boolean => (q.options ?? []).length > 0;

/**
 * Câu có lựa chọn vào thẻ; câu mở trả lời bằng ô chat. `open` gồm mọi câu mở (để ghép câu trả lời gõ tay); `listed` là
 * phần câu mở phải hiện thành dòng riêng trong tin AI — câu `inline` chỉ được bỏ khi lời AI (`reply`) đã chứa nó.
 */
export const splitQuestions = (questions: Question[], reply = ""): { card: Question[]; open: Question[]; listed: Question[] } => {
  const open = questions.filter((q) => !hasOptions(q));
  // `inline` chỉ được ẩn khi lời AI thật sự chứa câu đó — nếu không, user sẽ không thấy câu đang chờ trả lời
  return { card: questions.filter(hasOptions), open, listed: open.filter((q) => !q.inline || !replyContainsQuestion(reply, q.text)) };
};

/** Một đoạn chữ thành `answers[]`: dạng `n. ...` thì tách theo thứ tự câu, không thì cả đoạn cho câu đầu. */
export const toStepAnswers = (questions: Question[], text: string): StepAnswer[] => {
  const trimmed = text.trim();
  if (!trimmed || questions.length === 0) return [];
  if (questions.length === 1) return [{ question_id: questions[0].id, answer: trimmed }];
  const byIndex = new Map<number, string>();
  for (const line of trimmed.split("\n")) {
    const match = /^(\d+)\.\s+([\s\S]*)$/.exec(line.trim());
    if (match) byIndex.set(Number(match[1]) - 1, match[2].trim());
  }
  const split = questions.flatMap((q, i) => {
    const answer = byIndex.get(i);
    return answer ? [{ question_id: q.id, answer }] : [];
  });
  return split.length > 0 ? split : [{ question_id: questions[0].id, answer: trimmed }];
};

/**
 * Trả lời gõ thẳng ở ô chat. Có câu mở ⇒ chữ gõ trả lời các câu mở (đánh số như trong tin nhắn AI); không có
 * câu mở ⇒ trả lời câu đầu của thẻ như trước. BE chỉ ghi sổ quyết định cho câu mở khi tách được theo câu.
 */
export const directReplyAnswers = (questions: Question[], text: string): StepAnswer[] => {
  const { open } = splitQuestions(questions);
  return toStepAnswers(open.length > 0 ? open : questions, text);
};

/** Gộp hai nguồn câu trả lời; nguồn đầu thắng khi trùng câu. */
export const mergeAnswers = (primary: StepAnswer[], secondary: StepAnswer[]): StepAnswer[] => {
  const ids = new Set(primary.map((a) => a.question_id));
  return [...primary, ...secondary.filter((a) => !ids.has(a.question_id))];
};

const cardAnswers = (card: Question[], values: (string | string[] | null)[]): StepAnswer[] =>
  card.flatMap((q, i) => {
    const value = values[i];
    return value === null || value === undefined ? [] : [{ question_id: q.id, answer: value }];
  });

export default function ElicitPanel({ questions, onSubmit, chatDraft = "", onChatDraftUsed, onCardChange, onDismiss, sending = false }: ElicitPanelProps) {
  const { card, open } = splitQuestions(questions);
  if (card.length === 0) return null;
  return (
    <QuestionStepperInput
      key={questions.map((q) => q.id).join("|")}
      questions={card.map(toDiscoveryQuestion)}
      onChange={(values) => onCardChange?.(cardAnswers(card, values))}
      onSubmit={(values) => {
        // Câu mở đã gõ sẵn ở ô chat đi cùng lượt gửi — một POST /answer đủ câu
        const typed = open.length > 0 ? toStepAnswers(open, chatDraft) : [];
        const answers = mergeAnswers(cardAnswers(card, values), typed);
        if (answers.length === 0) return;
        onSubmit(answers);
        if (typed.length > 0) onChatDraftUsed?.();
      }}
      onDismiss={onDismiss}
      sending={sending}
    />
  );
}
