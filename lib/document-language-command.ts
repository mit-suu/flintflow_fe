import type { DocumentLanguage } from "@/types/project";

/**
 * Lệnh đổi ngôn ngữ tài liệu gõ trong chat (FLF-265 §3.7, D15). Ngôn ngữ user chat KHÔNG đụng tới tài liệu — chỉ một câu
 * ra lệnh rõ (động từ + đích ngôn ngữ + đối tượng là tài liệu) mới được chặn lại trước khi gửi. Cả tin nhắn phải là câu
 * lệnh (khớp từ đầu tới cuối, cho phép vài từ lịch sự hai đầu): câu chỉ nhắc tới "tiếng Anh" hay một đoạn chat dài có
 * lẫn câu lệnh ⇒ `null`, đi đường gửi bình thường. Khớp nhầm nhẹ chấp nhận được — user luôn phải xác nhận ở thẻ và có
 * nút "Gửi như tin nhắn".
 */

/** Thường hoá: chữ thường, bỏ dấu (gõ không dấu vẫn khớp), bỏ dấu câu, gộp khoảng trắng. */
const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ─── tiếng Việt (đã bỏ dấu) ─────────────────────────────────────
/** Từ đệm trước động từ: "bạn", "hãy", "giúp mình", "làm ơn", "mình muốn"… */
const VI_PRE = String.raw`(?:(?:ban|hay|lam on|vui long|giup|gium|ho|cho|minh|toi|tui|em|muon|can|oi)\s+)*`;
/** Từ đệm cuối câu: "nhé", "giúp mình", "với", "được không"… */
const VI_SUF = String.raw`(?:\s+(?:nhe|nha|nhen|di|voi|a|giup|gium|ho|minh|toi|tui|em|ban|luon|ngay|duoc|dc|khong|ko|k|cam on|thanks|please|pls))*`;
/** Đối tượng là tài liệu: "tài liệu", "SRS", "toàn bộ tài liệu này", "ngôn ngữ (của) tài liệu"… */
const VI_DOC = String.raw`(?:(?:toan bo|ca|het)\s+)?(?:ngon ngu\s+(?:cua\s+)?)?(?:(?:ban|bo)\s+)?(?:tai lieu|srs|van ban)(?:\s+srs)?(?:\s+nay)?`;
/** "đổi ngôn ngữ sang …" — đối tượng ngầm hiểu là ngôn ngữ (của tài liệu). */
const VI_DOC_OR_LANGUAGE = String.raw`(?:${VI_DOC}|ngon ngu)`;
const VI_TARGET = String.raw`(?:sang|qua|thanh|ra)\s+(?:tieng\s+)?(anh|viet|english|vietnamese)`;
/** "dịch" thì đối tượng tuỳ chọn ("dịch sang tiếng Anh"); "đổi" / "chuyển" phải nêu tài liệu hoặc ngôn ngữ. */
const VI_TRANSLATE = new RegExp(String.raw`^${VI_PRE}(?:dich|chuyen ngu)(?:\s+${VI_DOC})?\s+${VI_TARGET}(?:\s+${VI_DOC})?${VI_SUF}$`);
const VI_SWITCH = new RegExp(String.raw`^${VI_PRE}(?:doi|chuyen(?: doi)?)\s+${VI_DOC_OR_LANGUAGE}\s+${VI_TARGET}${VI_SUF}$`);

// ─── tiếng Anh ──────────────────────────────────────────────────
const EN_PRE = String.raw`(?:(?:please|pls|kindly|can you|could you|would you|can u|i want to|i wanna|id like to|i would like to|lets|let us|now|ok|okay)\s+)*`;
const EN_SUF = String.raw`(?:\s+(?:please|pls|thanks|thank you|now|for me))*`;
const EN_DOC = String.raw`(?:(?:the|this|my|our|whole|entire|full)\s+)*(?:document|doc|srs|spec|specification)`;
const EN_TARGET = String.raw`(?:to|into|in to)\s+(english|vietnamese)`;
/** "translate" thì đối tượng tuỳ chọn ("translate to English"); "switch / change / convert / set" phải nêu tài liệu. */
const EN_TRANSLATE = new RegExp(String.raw`^${EN_PRE}translate(?:\s+(?:${EN_DOC}|it|everything))?\s+${EN_TARGET}${EN_SUF}$`);
const EN_SWITCH = new RegExp(
  String.raw`^${EN_PRE}(?:switch|change|convert|set)\s+(?:(?:the\s+)?language\s+of\s+${EN_DOC}|${EN_DOC}(?:\s+language)?)\s+${EN_TARGET}${EN_SUF}$`
);

const TARGET_OF: Record<string, DocumentLanguage> = { anh: "en", english: "en", viet: "vi", vietnamese: "vi" };

/** Ngôn ngữ đích của một lệnh đổi ngôn ngữ tài liệu, hoặc `null` nếu tin nhắn không phải lệnh đó. */
export const parseLanguageCommand = (text: string): DocumentLanguage | null => {
  const normalized = normalize(text);
  if (!normalized) return null;
  for (const pattern of [VI_TRANSLATE, VI_SWITCH, EN_TRANSLATE, EN_SWITCH]) {
    const match = pattern.exec(normalized);
    if (match) return TARGET_OF[match[1]] ?? null;
  }
  return null;
};

/**
 * Lệnh đã khớp thì làm gì:
 * - `send` — không phải lệnh, hoặc Viewer (không chặn gì, đi đường cũ);
 * - `locked` — mode 1: dự án upload giữ ngôn ngữ của file (D3);
 * - `same` — tài liệu đã ở ngôn ngữ đó: vẫn không gửi cho AI (AI sẽ viết lại chữ Spine sang ngôn ngữ khác);
 * - `switch` — mode 2, Lead/Analyst, đích khác ngôn ngữ hiện tại: hỏi xác nhận rồi mới đổi.
 */
export type LanguageCommandOutcome = "send" | "locked" | "same" | "switch";

export const languageCommandOutcome = ({
  target,
  canEdit,
  mode1,
  current,
}: {
  target: DocumentLanguage | null;
  canEdit: boolean;
  mode1: boolean;
  current: DocumentLanguage | null;
}): LanguageCommandOutcome => {
  if (target === null || !canEdit) return "send";
  if (mode1) return "locked";
  return target === current ? "same" : "switch";
};
