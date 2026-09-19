"use client";

import { useState } from "react";
import { MAX_CLARIFY_ROUNDS, type Cr } from "@/types/change-request";

interface ClarifyPanelProps {
  cr: Cr;
  /** Câu hỏi đang chờ trả lời (`awaiting_answers`). */
  pendingQuestions: string[];
  onAnswer: (answers: string[]) => void;
  busy?: boolean;
}

/** 3.2–3.3 Làm rõ (C-2, UC-49): AI hỏi khi CR mơ hồ, tối đa 3 vòng rồi bắt buộc đi tiếp. */
export default function ClarifyPanel({ cr, pendingQuestions, onAnswer, busy = false }: ClarifyPanelProps) {
  const [answers, setAnswers] = useState<string[]>(() => pendingQuestions.map(() => ""));
  const answered = cr.clarifications.filter((c) => c.answers.length > 0);
  const complete = answers.length === pendingQuestions.length && answers.every((a) => a.trim());

  return (
    <div className="flex flex-col gap-3">
      {answered.map((round) => (
        <div key={round.round} className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 text-[12.5px] flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-[#8A867E]">Vòng {round.round}</p>
          {round.questions.map((q, i) => (
            <div key={i}>
              <p className="font-semibold text-[#191817]">❓ {q}</p>
              <p className="text-[#4B4842] pl-5">↳ {round.answers[i]}</p>
            </div>
          ))}
        </div>
      ))}

      {pendingQuestions.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (complete) onAnswer(answers.map((a) => a.trim()));
          }}
          className="bg-[#FBF4E4] border border-[#EFD9A6] rounded-[12px] p-3 flex flex-col gap-2.5"
          aria-label="Trả lời câu hỏi làm rõ"
        >
          <p className="text-[12.5px] font-bold text-[#8A6D1F]">
            AI cần làm rõ trước khi tìm vị trí sửa (vòng {cr.clarifications.length}/{MAX_CLARIFY_ROUNDS}):
          </p>
          {pendingQuestions.map((q, i) => (
            <label key={i} className="flex flex-col gap-1 text-[12.5px] font-semibold text-[#191817]">
              {q}
              <textarea
                rows={2}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#EFD9A6] bg-white text-[12.5px] font-normal"
              />
            </label>
          ))}
          <div className="flex justify-end">
            <button type="submit" disabled={!complete || busy} className="px-4 py-1.5 rounded-[8px] bg-[#191817] text-white text-[12.5px] font-bold disabled:opacity-50">
              {busy ? "Đang gửi…" : "Gửi câu trả lời"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
