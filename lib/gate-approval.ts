/**
 * Tin nhắn gõ tay ở cổng duyệt có phải một tiếng "ừ" hay không.
 *
 * Cổng là một tin nhắn mời duyệt bằng lời ("Bạn xem giúp, ổn thì mình đi tiếp nhé") nên user trả lời bằng
 * chữ là chuyện tự nhiên. Trước đây mọi chữ gõ ở cổng đều thành `revision`: gõ "oke" là bắt AI soạn lại,
 * ra bản gần y hệt, mở cổng mới — vòng lặp, mỗi vòng một lượt gọi model và một phần credit.
 *
 * Phép so cố ý **hẹp**: chỉ nhận khi cả tin nhắn rút gọn lại đúng một từ đồng ý. "ok nhưng đổi vai trò X"
 * mà nhận thành duyệt là chốt nhầm một bước — hỏng nặng hơn bệnh đang chữa. Nghi ngờ thì trả `false` và
 * lối `revision` cũ chạy như cũ.
 */

/** Từ đồng ý đứng một mình. Hai ngôn ngữ vì phiên trả lời có thể là tiếng Anh. */
const APPROVAL = new Set([
  "ok",
  "oke",
  "okê",
  "okie",
  "oki",
  "okay",
  "ừ",
  "ừa",
  "uh",
  "uhm",
  "um",
  "vâng",
  "dạ",
  "đồng ý",
  "nhất trí",
  "duyệt",
  "chốt",
  "được",
  "ổn",
  "tốt",
  "chuẩn",
  "đúng",
  "yes",
  "yep",
  "yeah",
  "sure",
  "agreed",
  "approve",
  "approved",
  "lgtm",
  "fine",
  "good",
  "looks good",
  "sounds good",
]);

/** Đuôi thân mật không mang nghĩa — cắt dần cho tới khi hết ("được rồi nhé" ⇒ "được"). */
const TRAILING = /\s+(nhé|nhe|nha|nhen|nhỉ|ạ|à|luôn|rồi|đi|thôi|bạn|nhá)$/u;

/** Có phủ định ở bất kỳ đâu ⇒ không phải lời duyệt ("chưa ổn", "ok nhưng không duyệt"). */
const NEGATION = /(^|[^\p{L}])(không|chưa|ko|k|đừng|nhưng|no|not|nope|but)([^\p{L}]|$)/u;

/** Dài hơn mức này thì chắc chắn có nội dung, không phải một tiếng "ừ". */
const MAX_LENGTH = 24;

/**
 * `true` ⇒ user đang duyệt, lối gọi phải đi đúng đường của chip Duyệt (kể cả bước xác nhận giả định).
 * `false` ⇒ coi là lời nhắn sửa như trước.
 */
export const isGateApproval = (raw: string): boolean => {
  const base = raw.normalize("NFC").toLowerCase().trim();
  if (base === "" || base.length > MAX_LENGTH || base.includes("?") || NEGATION.test(base)) return false;

  let text = base
    .replace(/[.!…,;:~\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text.replace(TRAILING, "").trim();
  }
  return APPROVAL.has(text);
};
