"use client";

import AuthGuard from "@/components/AuthGuard";
import OrgGuard from "@/components/OrgGuard";
import AppShell from "@/components/layout/AppShell";
import AppSidebar, { type SidebarUser } from "@/components/layout/AppSidebar";
import { getStoredAuthToken, decodeJwt } from "@/lib/auth";
import { ProjectsProvider } from "@/lib/hooks/use-projects";

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
      <ProjectsProvider>
        <AppShell sidebar={<AppSidebar user={user} />}>
          <OrgGuard>{children}</OrgGuard>
        </AppShell>
      </ProjectsProvider>
    </AuthGuard>
  );
}
