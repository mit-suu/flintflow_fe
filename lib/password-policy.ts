/**
 * Chuẩn mật khẩu mới — **bản sao của BE** (`flintflow_be/src/shared/utils/password-policy.ts`).
 * Sửa bên này thì sửa cả bên kia, và ngược lại.
 *
 * Đây là **cổng chặn**: không đạt thì FE khoá nút và BE trả 400. Ngưỡng đạt là mức "Khá" trở lên —
 * xem `PASSWORD_MIN_LEVEL`. FE giữ bản sao để báo tại chỗ và vẽ thanh độ mạnh, không phải để thay BE
 * quyết định. Không áp cho đăng nhập — tài khoản cũ có thể yếu hơn chuẩn mới.
 *
 * Module này **thuần, không giữ câu chữ**: nó trả *key* (`PasswordIssue`, `PasswordLevel`), chữ hiển thị
 * nằm ở `messages/{vi,en}.json` namespace `password`. App đã chạy hai ngôn ngữ nên nhúng chuỗi tiếng Việt
 * ở đây là làm rơi bản `en` (xem `app/(auth)/auth-i18n.test.tsx`).
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt ở BE chỉ băm 72 byte đầu, phần dư bị bỏ im lặng. Mật khẩu chỉ nhận ASCII nên 1 ký tự = 1 byte.
 */
export const PASSWORD_MAX_LENGTH = 72;

/** Số nhóm ký tự tối thiểu trong 4 nhóm: chữ thường · chữ HOA · chữ số · ký tự đặc biệt. */
export const PASSWORD_MIN_CHAR_CLASSES = 3;

/** Độ dài để được coi là "dài" khi chấm mức — mốc 12 theo NIST SP 800-63B. */
const PASSWORD_LONG_LENGTH = 12;

export type PasswordIssue =
  | "too_short"
  | "too_long"
  | "not_ascii"
  | "not_complex"
  | "not_strong_enough";

/**
 * Tham số ICU cho các chuỗi `password.issue.*`. Chỗ nào dịch chuỗi lỗi thì truyền nguyên cái này, để
 * ngưỡng trong câu chữ luôn là ngưỡng thật của module — không phải con số viết cứng trong bản dịch.
 */
export const PASSWORD_ISSUE_VALUES = {
  min: PASSWORD_MIN_LENGTH,
  max: PASSWORD_MAX_LENGTH,
  classes: PASSWORD_MIN_CHAR_CLASSES,
  long: PASSWORD_LONG_LENGTH
} as const;

/**
 * Danh sách mật khẩu bị dò nhiều nhất + các từ gắn với chính sản phẩm (kiểu `flintflow2024`) — đây là
 * thứ người ta gõ đầu tiên khi bị ép "phải có chữ hoa và số", nên nó qua được bài kiểm tra độ phức tạp.
 * Cố tình ngắn và thủ công: chặn hết rò rỉ là việc của rate limit + MFA, không phải của một mảng hằng.
 */
/** ASCII in được, KHÔNG gồm khoảng trắng (0x21–0x7E). Chặn cả chữ có dấu lẫn emoji. */
const ASCII_ONLY = /^[\x21-\x7E]+$/;

const countCharClasses = (password: string): number =>
  [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;

/** 0 = yếu · 1 = trung bình · 2 = khá · 3 = mạnh. Đạt chuẩn từ `PASSWORD_MIN_LEVEL`. */
export type PasswordLevel = 0 | 1 | 2 | 3;

export const PASSWORD_MIN_LEVEL: PasswordLevel = 2;

/** Key chữ của từng mức trong `messages` (`password.level.*`). */
export const PASSWORD_LEVEL_KEYS: Record<PasswordLevel, "weak" | "medium" | "fair" | "strong"> = {
  0: "weak",
  1: "medium",
  2: "fair",
  3: "strong"
};

/**
 * Vi phạm luật cứng ĐẦU TIÊN, hoặc `null` nếu mật khẩu qua hết. Trả một lỗi chứ không phải cả danh sách:
 * người dùng sửa từng cái một, dội 4 dòng đỏ cùng lúc chỉ làm họ bỏ cuộc.
 *
 * Không xét "đủ mạnh chưa" — đó là việc của `passwordLevel` / `checkPassword`.
 */
const basicIssue = (password: string): PasswordIssue | null => {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (password.length > PASSWORD_MAX_LENGTH) return "too_long";
  if (!ASCII_ONLY.test(password)) return "not_ascii";
  if (countCharClasses(password) < PASSWORD_MIN_CHAR_CLASSES) return "not_complex";
  return null;
};

/**
 * Mức độ mạnh để vẽ thanh đo. Qua hết luật cứng rồi mới chấm thêm theo độ dài và số nhóm ký tự,
 * vì với cùng bộ quy tắc, dài thêm một ký tự đáng giá hơn nhiều so với thêm một dấu chấm than.
 */
export const passwordLevel = (password: string): PasswordLevel => {
  if (basicIssue(password)) return 0;

  const long = password.length >= PASSWORD_LONG_LENGTH;
  const allClasses = countCharClasses(password) === 4;
  if (long && allClasses) return 3;
  if (long || allClasses) return 2;
  return 1;
};

/** Lý do mật khẩu bị từ chối, hoặc `null` nếu đạt chuẩn và được phép dùng. */
export const checkPassword = (password: string): PasswordIssue | null => {
  const issue = basicIssue(password);
  if (issue) return issue;
  return passwordLevel(password) < PASSWORD_MIN_LEVEL ? "not_strong_enough" : null;
};
