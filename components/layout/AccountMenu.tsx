"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import DropdownMenu, { type DropdownMenuItem, type DropdownTriggerProps } from "@/components/ui/DropdownMenu";
import Skeleton from "@/components/ui/Skeleton";
import { logoutAndRedirect } from "@/lib/auth";
import { useActiveOrganizationState } from "@/lib/hooks/use-active-org";
import { useAppShell, type AppUser } from "./AppShell";

interface AccountMenuProps {
  user: AppUser;
  /** Nút mở menu — mỗi chỗ đặt tự quyết hình dáng (avatar trần ở thanh trên, cả hàng ở thanh bên). */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  placement?: "top" | "bottom-end";
  /** Gọi trước khi điều hướng — thanh bên dùng để đóng drawer trên mobile. */
  onNavigate?: () => void;
}

/**
 * Menu tài khoản: hồ sơ, thanh toán (kèm nhãn gói), đăng xuất. Một định nghĩa duy nhất cho mọi chỗ đặt —
 * trước đây nó nằm trong `AppSidebar`, nên muốn có menu ở thanh trên là phải chép lại cả danh sách mục.
 */
export default function AccountMenu({ user, trigger, placement = "bottom-end", onNavigate }: AccountMenuProps) {
  const t = useTranslations("app.shell");
  const router = useRouter();
  const { balance } = useAppShell();
  const { org: activeOrg, loading: orgLoading, error: orgError } = useActiveOrganizationState();
  const hideBilling = orgLoading || orgError || activeOrg?.role === "viewer";

  const planLabel = user.isAdmin ? t("planAdmin") : balance ? t("plan", { plan: balance.planLabel }) : t("planFree");

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const items: DropdownMenuItem[] = [
    { label: t("profile"), icon: "user", onSelect: () => go("/home/profile") },
    ...(hideBilling
      ? []
      : [
          {
            label: t("billing"),
            icon: "credit-card" as const,
            onSelect: () => go("/home/billing"),
            trailing: <Badge>{planLabel}</Badge>,
          },
        ]),
    { label: t("logout"), icon: "logout", tone: "danger", onSelect: () => void logoutAndRedirect() },
  ];

  return (
    <DropdownMenu
      placement={placement}
      header={
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} email={user.email} brandFallback />
          <span className="min-w-0">
            {/* Tên là dữ liệu hồ sơ: chưa về thì thanh giữ chỗ, không đoán từ email */}
            {user.name ? (
              <span className="block text-body font-semibold text-on-surface truncate">{user.name}</span>
            ) : (
              <Skeleton className="h-3.5 w-28 my-[3px]" />
            )}
            <span className="block text-caption text-on-surface-muted truncate">{user.email}</span>
          </span>
        </div>
      }
      items={items}
      trigger={trigger}
    />
  );
}
