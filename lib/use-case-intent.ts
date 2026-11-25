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

/** Phủ định đứng ngay trước động từ ("không thêm UC nữa", "đừng xoá", "don't remove") ⇒ động từ đó không phải ý của câu. */
const NEGATION_BEFORE = /(?:^|[^\p{L}'])(?:không|chưa|đừng|chẳng|ko|don'?t|do not|not|never)\s+$/iu;

/** Vị trí đầu tiên `re` khớp mà không bị phủ định ngay trước (`Infinity` khi không có) - cùng luật `affirmedIndex` của BE. */
const affirmedIndex = (re: RegExp, text: string): number => {
  const all = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (const m of text.matchAll(all)) if (!NEGATION_BEFORE.test(text.slice(Math.max(0, m.index - 12), m.index))) return m.index;
  return Infinity;
};

export const editUseCaseIntent = (instruction: string): UseCaseIntent | null => {
  if (!USE_CASE_WORD.test(instruction)) return null;
  const found = (
    [
      ["add", affirmedIndex(ADD_VERB, instruction)],
      ["remove", affirmedIndex(REMOVE_VERB, instruction)],
      ["edit", affirmedIndex(EDIT_VERB, instruction)],
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
