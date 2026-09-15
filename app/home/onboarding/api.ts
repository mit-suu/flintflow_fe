/**
 * `PATCH /users/me` — chưa có trong `pipeline-contract.md` (đóng băng M2, chỉ pipeline).
 * BE nhỏ cho UC 1.12 (task-16, "phối hợp A/C, ≤ 1 điểm"): thêm `name`, `onboardedAt` vào
 * `modules/user`. KHÔNG sửa BE đêm nay (đang review nhánh T14) — FE gọi thẳng endpoint, dùng
 * kiểu mở rộng cục bộ vì `types/user.ts` (T07) chưa khai báo hai field này.
 * TODO(XREQ-local-1): xin `modules/user` thêm `PATCH /users/me { name?, onboardedAt? }` +
 * field `onboardedAt: Date | null` vào `user.model`; đồng bộ `types/user.ts` khi được duyệt.
 */
import { apiCall } from "@/lib/api/client";
import type { User } from "@/types/user";

export type UserWithOnboarding = User & { name?: string; onboardedAt?: string | null };

export interface PatchMeRequest {
  name?: string;
  onboardedAt?: string | null;
}

export const patchMe = (body: PatchMeRequest) =>
  apiCall<UserWithOnboarding>("/users/me", { method: "PATCH", body: JSON.stringify(body) });
