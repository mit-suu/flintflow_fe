"use client";

import AuthGuard from "@/components/AuthGuard";
import HomeFrame from "@/components/layout/HomeFrame";
import { type AppUser } from "@/components/layout/AppShell";
import { getAccessToken, decodeJwt } from "@/lib/auth";

function getUserInfo(): AppUser {
  const token = getAccessToken();
  const payload = token ? decodeJwt(token) : null;
  const email = payload?.email ?? "";
  return {
    name: email ? email.split("@")[0] : "User",
    email,
    isAdmin: payload?.role === "admin",
  };
}

/** Đọc user khi đã qua AuthGuard: token chỉ nằm trong bộ nhớ, trước lần refresh đầu tiên thì chưa có. */
function UserHomeFrame({ children }: { children: React.ReactNode }) {
  return <HomeFrame user={getUserInfo()}>{children}</HomeFrame>;
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <UserHomeFrame>{children}</UserHomeFrame>
    </AuthGuard>
  );
}
