"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";
import OrgGuard, { ONBOARDING_PATH, ORGANIZATIONS_PATH } from "@/components/OrgGuard";
import Button from "@/components/ui/Button";
import { logoutAndRedirect } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api/token-store";
import { fetchMe } from "@/lib/api/users";
import { writeProfileName } from "@/lib/profile-name-cache";
import { useAccountLocaleSync } from "@/lib/hooks/use-account-locale";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import type { User } from "@/types/user";
import AppShell, { type AppUser } from "./AppShell";
import AppSidebar from "./AppSidebar";

/**
 * Khung của `/home/*`. Đặt TRONG `AuthGuard` (chỉ chạy ở client sau khi xác thực) nên đọc token ở đây không lệch SSR.
 *
 * Chưa có tổ chức (token không mang `orgId`) ⇒ khung tối giản: logo, ngôn ngữ, đăng xuất — KHÔNG dựng thanh bên
 * và `ProjectsProvider`. Trước đây thanh bên vẫn hiện "Dự án", "Đổi tổ chức", "Thành viên", "Credits" và "Gói
 * Free" khi chưa có tổ chức nào: bấm mục nào cũng bị đẩy ngược về onboarding, còn provider và số dư thì tải
 * bằng token chưa có org ⇒ 409. `OrgGuard` vẫn quyết định ở lại onboarding, tự mở org, hay đẩy về onboarding.
 */
export default function HomeFrame({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("app.shell");
  // JWT không có tên ⇒ layout chỉ có tên đã nhớ (hoặc rỗng: avatar là logo). Lấy tên thật từ hồ sơ rồi nhớ lại cho lần
  // tải sau; lỗi thì giữ tên đang có.
  const [me, setMe] = useState<User | null>(null);
  // Mọi lần đăng nhập đều vào /home ⇒ có hồ sơ là đồng bộ ngôn ngữ tài khoản với ngôn ngữ đang hiển thị (FLF-259).
  useAccountLocaleSync(me);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((profile) => {
        if (!mounted) return;
        setMe(profile);
        // Nhớ đúng tên sẽ hiện (kể cả tên chốt từ email) ⇒ lần tải sau avatar ra đúng chữ ngay
        writeProfileName({ userId: profile.id, name: profile.name?.trim() || profile.email.split("@")[0] });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  // Hồ sơ đã về mà chưa đặt tên ⇒ tên chốt là phần trước `@` của email (như trang Hồ sơ); chưa về thì giữ tên đã nhớ / rỗng
  const profileName = me ? me.name?.trim() || me.email.split("@")[0] : null;

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
          {pathname === ONBOARDING_PATH || pathname === ORGANIZATIONS_PATH ? children : <OrgGuard>{children}</OrgGuard>}
        </main>
      </div>
    );
  }

  return (
    <ProjectsProvider>
      <AppShell
        user={profileName ? { ...user, name: profileName } : user}
        sidebar={<AppSidebar />}
      >
        <OrgGuard>{children}</OrgGuard>
      </AppShell>
    </ProjectsProvider>
  );
}
