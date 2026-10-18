"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import DropdownMenu, { type DropdownTriggerProps } from "@/components/ui/DropdownMenu";
import { logoutAndRedirect } from "@/lib/auth";
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

  const planLabel = user.isAdmin ? t("planAdmin") : balance ? t("plan", { plan: balance.planLabel }) : t("planFree");

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  return (
    <DropdownMenu
      placement={placement}
      header={
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} email={user.email} />
          <span className="min-w-0">
            <span className="block text-body font-semibold text-on-surface truncate">{user.name}</span>
            <span className="block text-caption text-on-surface-muted truncate">{user.email}</span>
          </span>
        </div>
      }
      items={[
        { label: t("profile"), icon: "user", onSelect: () => go("/home/profile") },
        {
          label: t("billing"),
          icon: "credit-card",
          onSelect: () => go("/home/billing"),
          trailing: <Badge>{planLabel}</Badge>,
        },
        { label: t("logout"), icon: "logout", tone: "danger", onSelect: () => void logoutAndRedirect() },
      ]}
      trigger={trigger}
    />
  );
}
