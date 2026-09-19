"use client";

import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import { getStoredAuthToken, decodeJwt } from "@/lib/auth";

function getUserInfo() {
  const token = getStoredAuthToken();
  if (!token) return { name: "User", plan: "Free Plan" };

  const payload = decodeJwt(token);
  const email = payload?.email ?? "";
  const name = email ? email.split("@")[0] : "User";
  const role = payload?.role ?? "user";
  const plan = role === "admin" ? "Admin" : "Free Plan";

  return { name, plan };
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = getUserInfo();

  return (
    <AuthGuard>
      <div
        className="flex h-screen overflow-hidden bg-[#F5F3F0]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <Sidebar user={user} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
