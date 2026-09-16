/** User trả về từ `GET /users/me` (kèm số dư ví credit). */
export interface User {
  id: string;
  email: string;
  name?: string;
  /** UC 1.12: ISO khi đã onboarding, `null` khi chưa. */
  onboardedAt?: string | null;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
}
