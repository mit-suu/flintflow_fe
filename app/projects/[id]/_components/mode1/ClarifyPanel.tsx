"use client";

import type { ReactNode } from "react";
import { MAX_CLARIFY_ROUNDS, type Cr } from "@/types/change-request";
import QuestionStepperInput from "../QuestionStepperInput";

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
 * bắt buộc đi tiếp. Câu hỏi hiện **như mode tạo SRS** (`QuestionStepperInput`): từng câu một, đáp án AI gợi ý đánh số để
 * chọn, dòng cuối tự gõ; câu chưa biết thì "Bỏ qua" ⇒ AI giả định. Đính kèm tài liệu có câu trả lời được ở ngay dưới.
 */
export default function ClarifyPanel({ cr, pendingQuestions, onAnswer, busy = false, materials }: ClarifyPanelProps) {
  const answered = cr.clarifications.filter((c) => c.answers.length > 0);
  const suggestions = cr.clarifications.at(-1)?.suggestions ?? [];

  return (
    <div className="flex flex-col gap-3">
      {answered.map((round) => (
        <div key={round.round} className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 text-[12.5px] flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-[#8A867E]">Vòng {round.round}</p>
          {round.questions.map((q, i) => (
            <div key={i}>
              <p className="font-semibold text-[#191817]">❓ {q}</p>
              <p className={`pl-5 ${round.answers[i]?.trim() ? "text-[#4B4842]" : "text-[#8A867E] italic"}`}>↳ {round.answers[i]?.trim() || "Chưa biết — AI sẽ giả định"}</p>
            </div>
          ))}
        </div>
      ))}

      {pendingQuestions.length > 0 && (
        <section className="bg-[#FBF4E4] border border-[#EFD9A6] rounded-[12px] pt-3 pb-2 flex flex-col gap-1" aria-label="Trả lời câu hỏi làm rõ">
          <p className="px-3 text-[12.5px] font-bold text-[#8A6D1F]">
            AI cần thêm thông tin trước khi tìm vị trí và viết nội dung (vòng {cr.clarifications.length}/{MAX_CLARIFY_ROUNDS}):
          </p>
          <p className="px-3 text-[11.5px] text-[#8A6D1F]">
            Chọn một gợi ý hoặc tự nhập câu trả lời. Câu chưa biết thì “Bỏ qua” — AI sẽ tự giả định và đánh dấu để người duyệt xác nhận.
          </p>
          <QuestionStepperInput
            key={`${cr.cr_id}:${cr.clarifications.length}`}
            questions={pendingQuestions.map((question, i) => ({ question, suggestedAnswers: suggestions[i] ?? [], multiple: false }))}
            onSendAnswerList={onAnswer}
            allowEmpty
            sending={busy}
          />
          {materials && <div className="px-3 pt-1">{materials}</div>}
        </section>
      )}
    </div>
  );
}
