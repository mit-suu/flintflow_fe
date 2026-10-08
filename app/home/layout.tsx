"use client";

import AuthGuard from "@/components/AuthGuard";
import HomeFrame from "@/components/layout/HomeFrame";
import { type SidebarUser } from "@/components/layout/AppSidebar";
import { getStoredAuthToken, decodeJwt } from "@/lib/auth";

function getUserInfo(): SidebarUser {
  const token = getStoredAuthToken();
  const payload = token ? decodeJwt(token) : null;
  const email = payload?.email ?? "";
  return {
    name: email ? email.split("@")[0] : "User",
    email,
    isAdmin: payload?.role === "admin",
  };
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = getUserInfo();

  return (
    <AuthGuard>
      <HomeFrame user={user}>{children}</HomeFrame>
    </AuthGuard>
  );
}
