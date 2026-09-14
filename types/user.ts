/** User trả về từ `GET /users/me` (kèm số dư ví credit). */
export interface User {
  id: string;
  email: string;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
}
