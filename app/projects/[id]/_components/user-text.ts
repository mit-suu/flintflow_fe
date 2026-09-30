/** Câu user "nói" khi bấm chip đồng ý ở cổng chốt — dùng cho tin hiện tạm và cho tin cũ đọc lại từ lịch sử. */
export const ACCEPT_USER_TEXT = "Đúng rồi, đi tiếp";
export const REGENERATE_USER_TEXT = "Làm lại giúp tôi";

const LEGACY_ACCEPT = "Duyệt, sang bước tiếp";
const LEGACY_REGENERATE = "Làm lại bước này";
const LEGACY_REVISION_PREFIX = /^Yêu cầu sửa:\s*/;

/**
 * Chữ hiển thị của tin user. Lịch sử cũ vẫn lưu tiền tố "Yêu cầu sửa: " và câu "Duyệt, sang bước tiếp" (chữ nội bộ) —
 * bỏ tiền tố, đổi câu duyệt về lời thường; mọi tin khác giữ nguyên.
 */
export const displayUserText = (content: string): string => {
  const text = content.trim();
  if (text === LEGACY_ACCEPT) return ACCEPT_USER_TEXT;
  if (text === LEGACY_REGENERATE) return REGENERATE_USER_TEXT;
  if (LEGACY_REVISION_PREFIX.test(text)) return text.replace(LEGACY_REVISION_PREFIX, "") || content;
  return content;
};
