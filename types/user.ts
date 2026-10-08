/** User trả về từ `GET /users/me` (kèm số dư ví credit). */
export interface User {
  id: string;
  email: string;
  name?: string;
  /** UC 1.12: ISO khi đã onboarding, `null` khi chưa. */
  onboardedAt?: string | null;
  /**
   * Ngôn ngữ giao diện đã lưu trong tài khoản (FLF-259). `null` = chưa chọn ⇒ lần vào `/home` đầu tiên lưu ngôn ngữ
   * đang hiển thị (`useAccountLocaleSync`).
   */
  locale?: "vi" | "en" | null;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Chỉ có ở `GET /users/me` (trang Hồ sơ). */
  authProvider?: "local" | "google";
  emailVerified?: boolean;
  /** `false` với tài khoản Google thuần ⇒ không có form đổi mật khẩu. */
  hasPassword?: boolean;
}
