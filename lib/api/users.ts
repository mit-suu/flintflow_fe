/** `PATCH /users/me` (BE `modules/user`) — tên hiển thị / mốc onboarding (UC 1.12) / ngôn ngữ (T25). */
import { apiCall } from "./client";
import type { Locale } from "@/lib/i18n";
import type { User } from "@/types/user";

export interface PatchMeRequest {
  name?: string;
  onboardedAt?: string | null;
  locale?: Locale;
}

export const patchMe = (body: PatchMeRequest) =>
  apiCall<User>("/users/me", { method: "PATCH", body: JSON.stringify(body) });
