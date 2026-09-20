/** User trả về từ `GET /users/me` (kèm số dư ví credit). */
export interface User {
  id: string;
  email: string;
  name?: string;
  /** UC 1.12: ISO khi đã onboarding, `null` khi chưa. */
  onboardedAt?: string | null;
  /** Ngôn ngữ giao diện + email; BE mặc định `vi`. */
  locale?: "vi" | "en";
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Chỉ có ở `GET /users/me` (trang Hồ sơ). */
  authProvider?: "local" | "google";
  emailVerified?: boolean;
  /** `false` với tài khoản Google thuần ⇒ không có form đổi mật khẩu. */
  hasPassword?: boolean;
}
