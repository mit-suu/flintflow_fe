"use client";

import AuthGuard from "@/components/AuthGuard";
import HomeFrame from "@/components/layout/HomeFrame";
import { type AppUser } from "@/components/layout/AppShell";
import ShellSkeleton, { type ShellMemory } from "@/components/layout/ShellSkeleton";
import { getAccessToken, decodeJwt } from "@/lib/auth";
import { readProfileName } from "@/lib/profile-name-cache";

/**
 * Người đang đăng nhập theo token. Token không có tên ⇒ dùng tên hồ sơ đã nhớ của đúng người này; chưa nhớ thì để rỗng
 * (avatar hiện logo FlintFlow) chứ không đoán từ email, để avatar không đổi chữ khi tên thật về (`HomeFrame`).
 */
function getUserInfo(): AppUser {
  const token = getAccessToken();
  const payload = token ? decodeJwt(token) : null;
  return {
    name: readProfileName(payload?.userId) ?? "",
    email: payload?.email ?? "",
    isAdmin: payload?.role === "admin",
  };
}

/** Đọc user khi đã qua AuthGuard: token chỉ nằm trong bộ nhớ, trước lần refresh đầu tiên thì chưa có. */
function UserHomeFrame({ children }: { children: React.ReactNode }) {
  return <HomeFrame user={getUserInfo()}>{children}</HomeFrame>;
}

/**
 * Phần client của `app/home/layout.tsx`. `remembered` là bản nhớ server đọc từ cookie, đưa cho khung chờ xác thực để HTML
 * đầu tiên đã có tên tổ chức, avatar, các mục theo vai trò và đúng bề ngang sidebar.
 */
export default function HomeLayoutClient({ remembered, children }: { remembered: ShellMemory; children: React.ReactNode }) {
  return (
    <AuthGuard renderSkeleton={(label) => <ShellSkeleton label={label} remembered={remembered} />}>
      <UserHomeFrame>{children}</UserHomeFrame>
    </AuthGuard>
  );
}
