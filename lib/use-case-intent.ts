/**
 * FLF-318: câu lệnh sửa là thêm hay xoá use case — cùng luật `useCaseIntent` của BE (`spine/use-case-propagation.ts`):
 * phải nhắc "use case" / "UC", động từ đứng TRƯỚC thắng ("xoá use case vừa tạo" là xoá). Workspace mode 1 dùng để đưa
 * lệnh thêm / xoá use case qua đúng vòng hỏi đáp + bản xem trước như trước baseline rồi mới tạo change request.
 */

const ADD_VERB = /(thêm|bổ sung|tạo|add|create|new)/i;
// `\b` của JS coi chữ có dấu là ngoài từ ⇒ "bỏ" dùng lookaround Unicode (không khớp "bổ sung")
const REMOVE_VERB = /(xoá|xóa|loại bỏ|(?<!\p{L})bỏ(?!\p{L})|gỡ|remove|delete|drop)/iu;
const USE_CASE_WORD = /(use[\s-]?case|\buc\b|ca sử dụng)/i;

export type UseCaseIntent = "add" | "remove";

export const editUseCaseIntent = (instruction: string): UseCaseIntent | null => {
  if (!USE_CASE_WORD.test(instruction)) return null;
  const add = ADD_VERB.exec(instruction)?.index ?? Infinity;
  const remove = REMOVE_VERB.exec(instruction)?.index ?? Infinity;
  if (add === Infinity && remove === Infinity) return null;
  return remove < add ? "remove" : "add";
};

/** Mô tả change request từ vòng hỏi đáp: lệnh đầu + từng câu trả lời làm rõ, theo thứ tự (≤ 5000 ký tự như form 3.1). */
export const describeConversation = (turns: readonly string[]): string => {
  const [first = "", ...answers] = turns.map((t) => t.trim()).filter(Boolean);
  const text = answers.length ? `${first}\n\nTrả lời làm rõ:\n${answers.map((a) => `- ${a}`).join("\n")}` : first;
  return text.slice(0, 5000);
};
