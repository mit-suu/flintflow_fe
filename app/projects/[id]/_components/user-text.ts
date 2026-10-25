import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

const MESSAGES = { vi, en } as const;

/**
 * Câu user "nói" khi bấm chip đồng ý ở cổng chốt — dùng cho tin hiện tạm và cho tin cũ đọc lại từ lịch sử. Đây là chữ
 * BE ghi transcript (dữ liệu, giữ tiếng Việt); `displayUserText` đổi nó sang ngôn ngữ giao diện lúc hiện.
 */
export const ACCEPT_USER_TEXT = "Đúng rồi, đi tiếp";
export const REGENERATE_USER_TEXT = "Làm lại giúp tôi";

const LEGACY_ACCEPT = "Duyệt, sang bước tiếp";
const LEGACY_REGENERATE = "Làm lại bước này";
const LEGACY_REVISION_PREFIX = /^Yêu cầu sửa:\s*/;

/**
 * Chữ hiển thị của tin user. Lịch sử cũ vẫn lưu tiền tố "Yêu cầu sửa: " và câu "Duyệt, sang bước tiếp" (chữ nội bộ) —
 * bỏ tiền tố, đổi câu duyệt về lời thường; mọi tin khác giữ nguyên.
 */
export const displayUserText = (content: string, locale: Locale = DEFAULT_LOCALE): string => {
  const text = content.trim();
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "workspace.userText" });
  if (text === LEGACY_ACCEPT || text === ACCEPT_USER_TEXT) return t("accept");
  if (text === LEGACY_REGENERATE || text === REGENERATE_USER_TEXT) return t("regenerate");
  if (LEGACY_REVISION_PREFIX.test(text)) return text.replace(LEGACY_REVISION_PREFIX, "") || content;
  return content;
};
