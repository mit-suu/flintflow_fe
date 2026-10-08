"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";
import OrgGuard, { ONBOARDING_PATH } from "@/components/OrgGuard";
import Button from "@/components/ui/Button";
import { logoutAndRedirect } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api/token-store";
import { fetchMe } from "@/lib/api/users";
import { useAccountLocaleSync } from "@/lib/hooks/use-account-locale";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import type { User } from "@/types/user";
import AppShell from "./AppShell";
import AppSidebar, { type SidebarUser } from "./AppSidebar";

/**
 * Khung của `/home/*`. Đặt TRONG `AuthGuard` (chỉ chạy ở client sau khi xác thực) nên đọc token ở đây không lệch SSR.
 *
 * Chưa có tổ chức (token không mang `orgId`) ⇒ khung tối giản: logo, ngôn ngữ, đăng xuất — KHÔNG dựng thanh bên
 * và `ProjectsProvider`. Trước đây thanh bên vẫn hiện "Dự án", "Đổi tổ chức", "Thành viên", "Credits" và "Gói
 * Free" khi chưa có tổ chức nào: bấm mục nào cũng bị đẩy ngược về onboarding, còn provider và số dư thì tải
 * bằng token chưa có org ⇒ 409. `OrgGuard` vẫn quyết định ở lại onboarding, tự mở org, hay đẩy về onboarding.
 */
export default function HomeFrame({ user, children }: { user: SidebarUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("app.shell");
  // JWT không có tên ⇒ layout chỉ đoán từ email ("lead.tien"). Lấy tên thật từ hồ sơ; lỗi thì giữ tên đoán.
  const [me, setMe] = useState<User | null>(null);
  // Mọi lần đăng nhập đều vào /home ⇒ có hồ sơ là đồng bộ ngôn ngữ tài khoản với ngôn ngữ đang hiển thị (FLF-259).
  useAccountLocaleSync(me);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((profile) => {
        if (mounted) setMe(profile);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const profileName = me?.name?.trim() || null;

  if (!getActiveOrgId()) {
    return (
      <div className="min-h-dvh bg-surface">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
          <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" />
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Button size="sm" variant="ghost" onClick={() => void logoutAndRedirect()}>
              {t("logout")}
            </Button>
          </div>
        </header>
        <main className="px-4 sm:px-6">
          {pathname === ONBOARDING_PATH ? children : <OrgGuard>{children}</OrgGuard>}
        </main>
      </div>
    );
  }

  return (
    <ProjectsProvider>
      <AppShell sidebar={<AppSidebar user={profileName ? { ...user, name: profileName } : user} />}>
        <OrgGuard>{children}</OrgGuard>
      </AppShell>
    </ProjectsProvider>
  );
}
