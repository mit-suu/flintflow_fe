import type { DiscoveryQuestion } from "@/types/chat";
import type { Question, QuestionOption } from "@/types/pipeline";

/** Đuôi đánh dấu phương án khuyến nghị — hiển thị thành badge, không gửi kèm câu trả lời. */
const RECOMMENDED_SUFFIX = /\s*\((khuyến nghị|recommended)\)\s*$/i;

/** Run-state cũ lưu option là chuỗi; từ FLF-220 là object. Mọi chỗ render đi qua đây. */
export const normalizeOption = (option: string | QuestionOption): QuestionOption =>
  typeof option === "string" ? { label: option } : option;

/** Tách nhãn và cờ khuyến nghị: `"99.9% (Khuyến nghị)"` ⇒ `{ text: "99.9%", recommended: true }`. */
export const splitRecommended = (label: string): { text: string; recommended: boolean } => {
  const recommended = RECOMMENDED_SUFFIX.test(label);
  return { text: recommended ? label.replace(RECOMMENDED_SUFFIX, "").trim() : label, recommended };
};

export const stripRecommended = (label: string): string => splitRecommended(label).text;

/** Câu hỏi của step dưới dạng thẻ hỏi dùng chung. */
export const toDiscoveryQuestion = (question: Question): DiscoveryQuestion => ({
  question: question.text,
  ...(question.header ? { header: question.header } : {}),
  options: (question.options ?? []).map(normalizeOption).filter((o) => o.label.trim().length > 0),
  multiple: question.multiple,
});

/** Tin nhắn CHAT: dạng mới `options` object, tin nhắn cũ `suggestedAnswers: string[]`, hoặc chuỗi trơn. */
export const parseChatQuestion = (raw: unknown): DiscoveryQuestion | null => {
  if (typeof raw === "string") return raw.trim() ? { question: raw, options: [] } : null;
  const item = (raw ?? {}) as { question?: unknown; header?: unknown; options?: unknown; suggestedAnswers?: unknown; multiple?: unknown };
  if (typeof item.question !== "string" || item.question.trim() === "") return null;
  const source = Array.isArray(item.options) ? item.options : Array.isArray(item.suggestedAnswers) ? item.suggestedAnswers : [];
  const options = source.flatMap((o: unknown): QuestionOption[] => {
    if (typeof o === "string") return o.trim() ? [{ label: o }] : [];
    const opt = (o ?? {}) as { label?: unknown; description?: unknown; preview?: unknown };
    if (typeof opt.label !== "string" || opt.label.trim() === "") return [];
    return [
      {
        label: opt.label,
        ...(typeof opt.description === "string" && opt.description ? { description: opt.description } : {}),
        ...(typeof opt.preview === "string" && opt.preview ? { preview: opt.preview } : {}),
      },
    ];
  });
  return {
    question: item.question,
    ...(typeof item.header === "string" && item.header ? { header: item.header } : {}),
    options,
    multiple: typeof item.multiple === "boolean" ? item.multiple : undefined,
  };
};
