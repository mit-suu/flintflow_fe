/**
 * P05 (QLHS #3b, luồng C #8): tin hỏi của AI đã được trả lời thì không còn trông như đang chờ. Trước đây câu hỏi trên thẻ khi vào
 * lịch sử bị bỏ lựa chọn (`askTranscript` BE, `keepAskInHistory` FE) nên vẽ lại thành danh sách câu hỏi mở đánh số — giống hệt
 * câu đang chờ, người dùng (và script E2E) trả lời lại lần nữa.
 *
 * Dấu hiệu "đã trả lời" không cần đổi contract: tin AI có `questions` khác rỗng mà ngay sau nó là tin của user cùng bước.
 * Trả về `index tin AI → nội dung câu trả lời`.
 */
export interface TranscriptLike {
  role: string;
  content: string;
  step?: string | null;
}

const hasQuestions = (content: string): boolean => {
  try {
    const data = JSON.parse(content) as { questions?: unknown };
    return Array.isArray(data?.questions) && data.questions.length > 0;
  } catch {
    return false;
  }
};

export const answeredQuestionMessages = (messages: readonly TranscriptLike[]): Map<number, string> => {
  const out = new Map<number, string>();
  messages.forEach((msg, idx) => {
    if (msg.role === "user" || !hasQuestions(msg.content)) return;
    const next = messages[idx + 1];
    if (!next || next.role !== "user") return;
    if (msg.step && next.step && msg.step !== next.step) return;
    out.set(idx, next.content);
  });
  return out;
};
