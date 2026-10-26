/**
 * FLF-318: câu lệnh sửa là thêm, xoá hay sửa use case — cùng luật `useCaseIntent` của BE (`spine/use-case-propagation.ts`):
 * phải nhắc "use case" / "UC", động từ đứng TRƯỚC thắng ("xoá use case vừa tạo" là xoá). Workspace mode 1 dùng để đưa
 * lệnh thêm / xoá / sửa use case qua đúng vòng hỏi đáp + bản xem trước như trước baseline rồi mới tạo change request.
 */

const ADD_VERB = /(thêm|bổ sung|tạo|add|create|new)/i;
// `\b` của JS coi chữ có dấu là ngoài từ ⇒ "bỏ" dùng lookaround Unicode (không khớp "bổ sung")
const REMOVE_VERB = /(xoá|xóa|loại bỏ|(?<!\p{L})bỏ(?!\p{L})|gỡ|remove|delete|drop)/iu;
const EDIT_VERB = /(sửa|chỉnh|cập nhật|thay|(?<!\p{L})đổi(?!\p{L})|edit|rename|update|change|modify)/iu;
// "UC", "UC01", "UC-26" (mã dính số) — `\buc\b` cũ không khớp "UC01"
const USE_CASE_WORD = /(use[\s-]?case|\buc(?![a-z])|ca sử dụng)/i;

export type UseCaseIntent = "add" | "remove" | "edit";

export const editUseCaseIntent = (instruction: string): UseCaseIntent | null => {
  if (!USE_CASE_WORD.test(instruction)) return null;
  const found = (
    [
      ["add", ADD_VERB.exec(instruction)?.index ?? Infinity],
      ["remove", REMOVE_VERB.exec(instruction)?.index ?? Infinity],
      ["edit", EDIT_VERB.exec(instruction)?.index ?? Infinity],
    ] as const
  )
    .filter(([, at]) => at !== Infinity)
    .sort((a, b) => a[1] - b[1]);
  return found[0]?.[0] ?? null;
};

/** Mô tả change request từ vòng hỏi đáp: lệnh đầu + từng câu trả lời làm rõ, theo thứ tự (≤ 5000 ký tự như form 3.1). */
export const describeConversation = (turns: readonly string[]): string => {
  const [first = "", ...answers] = turns.map((t) => t.trim()).filter(Boolean);
  const text = answers.length ? `${first}\n\nTrả lời làm rõ:\n${answers.map((a) => `- ${a}`).join("\n")}` : first;
  return text.slice(0, 5000);
};
