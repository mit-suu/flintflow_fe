/** `/users/me` (BE `modules/user`) — hồ sơ của user đang đăng nhập. */
import { apiCall } from "./client";
import type { User } from "@/types/user";

export const fetchMe = async (): Promise<User> => {
  const res = await apiCall<User>("/users/me");
  return res.data as User;
};

export const updateMyName = async (name: string): Promise<User> => {
  const res = await apiCall<User>("/users/me", { method: "PATCH", body: JSON.stringify({ name }) });
  return res.data as User;
};

/** Sai mật khẩu hiện tại ⇒ `ApiClientError` code `INVALID_CURRENT_PASSWORD` (HTTP 400). */
export const changeMyPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiCall("/users/me/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};
