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

/** Phương án có được khuyến nghị không: cờ `recommended` (FLF-449) hoặc đuôi trên nhãn (run-state cũ). */
export const isRecommendedOption = (option: Pick<QuestionOption, "label" | "recommended">): boolean =>
  option.recommended === true || splitRecommended(option.label).recommended;

/** Danh sách ưu / nhược / rủi ro từ dữ liệu chưa kiểm (tin chat lưu JSON model): chỉ giữ chuỗi khác rỗng. */
const textList = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

const listField = <K extends "pros" | "cons" | "risks">(key: K, raw: unknown): Partial<Record<K, string[]>> => {
  const list = textList(raw);
  return list.length > 0 ? ({ [key]: list } as Record<K, string[]>) : {};
};

const normalizeText = (text: string): string => text.replace(/[ \t\r\n]+/g, " ").trim().toLowerCase();

/** Lời AI đã chứa nguyên câu hỏi chưa (bỏ qua khác biệt khoảng trắng / hoa thường). */
export const replyContainsQuestion = (reply: string, question: string): boolean => {
  const needle = normalizeText(question);
  return needle !== "" && normalizeText(reply).includes(needle);
};

/** Câu hỏi của step dưới dạng thẻ hỏi dùng chung. */
export const toDiscoveryQuestion = (question: Question): DiscoveryQuestion => ({
  question: question.text,
  ...(question.header ? { header: question.header } : {}),
  options: (question.options ?? []).map(normalizeOption).filter((o) => o.label.trim().length > 0),
  multiple: question.multiple,
  ...(question.inline ? { inline: true } : {}),
  ...(question.recommendation_reason ? { recommendation_reason: question.recommendation_reason } : {}),
});

/** Tin nhắn CHAT: dạng mới `options` object, tin nhắn cũ `suggestedAnswers: string[]`, hoặc chuỗi trơn. */
export const parseChatQuestion = (raw: unknown): DiscoveryQuestion | null => {
  if (typeof raw === "string") return raw.trim() ? { question: raw, options: [] } : null;
  const item = (raw ?? {}) as {
    question?: unknown;
    header?: unknown;
    options?: unknown;
    suggestedAnswers?: unknown;
    multiple?: unknown;
    inline?: unknown;
    recommendation_reason?: unknown;
  };
  if (typeof item.question !== "string" || item.question.trim() === "") return null;
  const source = Array.isArray(item.options) ? item.options : Array.isArray(item.suggestedAnswers) ? item.suggestedAnswers : [];
  const options = source.flatMap((o: unknown): QuestionOption[] => {
    if (typeof o === "string") return o.trim() ? [{ label: o }] : [];
    const opt = (o ?? {}) as Record<"label" | "description" | "preview" | "pros" | "cons" | "risks" | "recommended", unknown>;
    if (typeof opt.label !== "string" || opt.label.trim() === "") return [];
    return [
      {
        label: opt.label,
        ...(typeof opt.description === "string" && opt.description ? { description: opt.description } : {}),
        ...(typeof opt.preview === "string" && opt.preview ? { preview: opt.preview } : {}),
        // FLF-449: trước đây chỉ chép 3 trường trên nên ưu / nhược / rủi ro / cờ khuyến nghị rơi mất ở tin chat
        ...listField("pros", opt.pros),
        ...listField("cons", opt.cons),
        ...listField("risks", opt.risks),
        ...(opt.recommended === true ? { recommended: true } : {}),
      },
    ];
  });
  return {
    question: item.question,
    ...(typeof item.header === "string" && item.header ? { header: item.header } : {}),
    options,
    multiple: typeof item.multiple === "boolean" ? item.multiple : undefined,
    ...(item.inline === true ? { inline: true } : {}),
    ...(typeof item.recommendation_reason === "string" && item.recommendation_reason.trim()
      ? { recommendation_reason: item.recommendation_reason }
      : {}),
  };
};
