/**
 * Câu rút lại yêu cầu gõ ở bước làm rõ ("thôi không cần nữa", "bỏ qua", "không đổi nữa", "never mind") — FLF-439.
 * Cùng luật với `flintflow_be/src/shared/i18n/withdrawal.ts` (BE dùng cho chat sửa tài liệu trước baseline; FE dùng cho
 * câu trả lời làm rõ của change request: khớp ⇒ hỏi "huỷ CR?" thay vì gửi làm câu trả lời). Sửa luật thì sửa cả hai.
 *
 * Cố ý KHÔNG nhận "không đổi", "giữ nguyên", "để như cũ" đứng một mình — đó thường là câu trả lời thật.
 */

// Hết từ = không còn chữ cái theo sau (`\b` của JS coi "ỷ" là ký tự ngoài từ ⇒ "huỷ" không khớp)
const LEADING = /^\s*(thôi|thoi|bỏ qua|bo qua|không cần|khong can|huỷ|hủy|huy|dừng|dung lai|cancel|never ?mind|skip it|forget it|no need)(?!\p{L})/iu;

const VERB = "(?:đổi|doi|sửa|sua|thêm|them|xoá|xóa|xoa|làm|lam|chỉnh|chinh)";
const FILLER = "(?:gì|gi|cả|ca|đâu|dau|luôn|luon|nha|nhé|nhe|nhá|ạ|đi|di|nào|nao)";
const END = `(?:\\s+${FILLER})*[\\s.!…]*$`;

/** "không đổi nữa", "ko sửa gì nữa đâu" — bắt buộc có "nữa". */
const NO_MORE = new RegExp(`^\\s*(?:(?:vậy|vay|thế|the|ok|oke|ừ|u)\\s+)?(?:không|khong|ko|k)\\s+${VERB}(?:\\s+${FILLER})*\\s+(?:nữa|nua)${END}`, "iu");
/** "khỏi", "khỏi sửa", "khỏi thêm nữa nha". */
const SKIP = new RegExp(`^\\s*(?:khỏi|khoi)(?:\\s+${VERB})?(?:\\s+(?:nữa|nua))?${END}`, "iu");
/** "no more changes", "drop it", "forget about it", "don't change anything". */
const EN_STOP = /^\s*(?:no more changes?|drop (?:it|this|this request|the request)|forget about it|don'?t change anything(?: else)?)(?:\s+(?:please|thanks))?[\s.!]*$/iu;

export const isWithdrawal = (text: string): boolean => {
  const value = text.normalize("NFC");
  return LEADING.test(value) || NO_MORE.test(value) || SKIP.test(value) || EN_STOP.test(value);
};

/** Mọi câu trả lời có chữ đều là lời rút lại (câu để trống = "chưa biết", không tính). Không có câu nào có chữ ⇒ `false`. */
export const answersWithdraw = (answers: readonly string[]): boolean => {
  const filled = answers.map((a) => a.trim()).filter(Boolean);
  return filled.length > 0 && filled.every(isWithdrawal);
};
