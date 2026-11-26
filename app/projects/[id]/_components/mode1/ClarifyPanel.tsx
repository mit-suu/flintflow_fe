"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MAX_CLARIFY_ROUNDS, type Cr } from "@/types/change-request";
import QuestionStepperInput, { answerLabel } from "../QuestionStepperInput";

interface ClarifyPanelProps {
  cr: Cr;
  /** Câu hỏi đang chờ trả lời (`awaiting_answers`). */
  pendingQuestions: string[];
  /** Câu trả lời theo từng câu; câu bỏ qua là `""` (= chưa biết — phase 7): AI ghi dữ kiện đó là giả định. */
  onAnswer: (answers: string[]) => void;
  busy?: boolean;
  /** Khối đính kèm tài liệu (phase 7) — người dùng trả lời bằng tài liệu. */
  materials?: ReactNode;
}

/**
 * 3.2–3.3 Làm rõ (C-2, UC-49): AI hỏi khi CR mơ hồ **hoặc thiếu dữ kiện để viết nội dung** (phase 7), tối đa 3 vòng rồi
 * bắt buộc đi tiếp (FLF-367: riêng câu hỏi CR mâu thuẫn với tài liệu thì hỏi cả sau vòng 3). Câu hỏi hiện **như mode tạo SRS** (`QuestionStepperInput`): từng câu một, đáp án AI gợi ý đánh số để
 * chọn, dòng cuối tự gõ; câu chưa biết thì "Bỏ qua" ⇒ AI giả định. Đính kèm tài liệu có câu trả lời được ở ngay dưới.
 */
export default function ClarifyPanel({ cr, pendingQuestions, onAnswer, busy = false, materials }: ClarifyPanelProps) {
  const t = useTranslations("mode1.clarify");
  const answered = cr.clarifications.filter((c) => c.answers.length > 0);
  const lastRound = cr.clarifications.at(-1);
  const suggestions = lastRound?.suggestions ?? [];
  // FLF-474: nhãn vòng do BE đếm (từ lần gộp lệnh gần nhất); BE cũ không gửi ⇒ tự đếm như trước
  const count = cr.clarify_round?.n ?? cr.clarifications.length;
  const max = cr.clarify_round?.max ?? MAX_CLARIFY_ROUNDS;
  const extra = cr.clarify_round?.extra ?? count > MAX_CLARIFY_ROUNDS;

  return (
    <div className="flex flex-col gap-3">
      {answered.map((round) => (
        <div key={round.round} className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 text-body flex flex-col gap-1.5">
          <p className="text-caption font-bold text-[#8A867E]">{t("round", { round: round.round })}</p>
          {round.questions.map((q, i) => (
            <div key={i}>
              <p className="font-semibold text-[#191817]">❓ {q}</p>
              <p className={`pl-5 ${round.answers[i]?.trim() ? "text-[#4B4842]" : "text-[#8A867E] italic"}`}>↳ {round.answers[i]?.trim() || t("unknown")}</p>
            </div>
          ))}
        </div>
      ))}

      {pendingQuestions.length > 0 && (
        <section className="bg-[#FBF4E4] border border-[#EFD9A6] rounded-[12px] pt-3 pb-2 flex flex-col gap-1" aria-label={t("aria")}>
          {/* FLF-367: câu hỏi mâu thuẫn với tài liệu hỏi cả khi đã hết số vòng làm rõ ⇒ không in "vòng 4/3" */}
          <p className="px-3 text-body font-bold text-[#8A6D1F]">
            {extra ? t("needConfirm", { round: count }) : t("need", { round: count, max })}
          </p>
          <p className="px-3 text-body text-[#8A6D1F]">{t("hint")}</p>
          <QuestionStepperInput
            key={`${cr.cr_id}:${cr.clarifications.length}`}
            // Câu mâu thuẫn với tài liệu: bắt chọn hoặc gõ, không cho gửi trống (câu mơ hồ vẫn bỏ qua được)
            questions={pendingQuestions.map((question, i) => ({
              question,
              options: (suggestions[i] ?? []).map((label) => ({ label })),
              multiple: false,
              required: lastRound?.kinds?.[i] === "contradiction",
            }))}
            onSubmit={(values) => onAnswer(values.map(answerLabel))}
            allowEmpty
            sending={busy}
          />
          {materials && <div className="px-3 pt-1">{materials}</div>}
        </section>
      )}
    </div>
  );
}
