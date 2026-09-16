/** `PATCH /users/me` (BE `modules/user`) — cập nhật tên hiển thị / mốc onboarding (UC 1.12). */
import { apiCall } from "@/lib/api/client";
import type { User } from "@/types/user";

export interface PatchMeRequest {
  name?: string;
  onboardedAt?: string | null;
}

export const patchMe = (body: PatchMeRequest) =>
  apiCall<User>("/users/me", { method: "PATCH", body: JSON.stringify(body) });
