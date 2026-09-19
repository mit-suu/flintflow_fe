"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useUnreadNotificationCount } from "@/components/NotificationBell";
import FeedbackDialog from "@/components/project/FeedbackDialog";
import Badge from "@/components/ui/Badge";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { clearAuthToken } from "@/lib/auth";
import { selectRecentProjects, useProjects } from "@/lib/hooks/use-projects";
import { useAppShell } from "./AppShell";
import RecentProjects from "./RecentProjects";
import SidebarNavItem from "./SidebarNavItem";
import { ORG_SWITCHER, SIDEBAR_SECTIONS, isSidebarItemActive } from "./sidebar-config";

export interface SidebarUser {
  name: string;
  email: string;
  isAdmin: boolean;
}

// Gradient avatar dựng từ token primary (không hex)
const AVATAR = "bg-gradient-to-br from-primary-light to-primary text-on-primary";

export default function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { navOpen, closeNav, collapsed: collapsedPref, toggleCollapsed, balance } = useAppShell();
  const { projects } = useProjects();
  const unreadCount = useUnreadNotificationCount();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Drawer mobile luôn mở rộng; thu gọn chỉ áp dụng trên desktop
  const collapsed = collapsedPref && !navOpen;
  const recent = selectRecentProjects(projects);
  const planLabel = user.isAdmin ? "Admin" : balance ? `Gói ${balance.planLabel}` : "Gói Free";
  const initial = user.name.charAt(0).toUpperCase();

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  return (
    <aside
      aria-label="Điều hướng chính"
      className={`h-dvh bg-surface-container-lowest border-r border-outline-variant flex flex-col gap-1 py-4 transition-[width] duration-200 ${
        collapsed ? "w-[68px] px-2.5" : "w-[248px] px-3"
      }`}
    >
      <div className={`flex items-center gap-2 pb-3 ${collapsed ? "flex-col" : "px-1.5"}`}>
        <Logo variant={collapsed ? "icon" : "wordmark"} sizeClassName={collapsed ? "w-6 h-6" : "h-4 w-auto"} theme="light" />
        {/* Chỉ desktop; bọc riêng vì `hidden` không thắng được `inline-flex` sẵn có của IconButton */}
        <span className="hidden md:contents">
          <IconButton
            icon={collapsed ? "angle-double-right" : "angle-double-left"}
            label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            size="sm"
            onClick={toggleCollapsed}
            className={collapsed ? "" : "ml-auto"}
          />
        </span>
        <IconButton icon="close" label="Đóng menu" size="sm" onClick={closeNav} className="ml-auto md:hidden" data-autofocus />
      </div>

      <div className={collapsed ? "" : "pb-2"}>
        <SidebarNavItem item={ORG_SWITCHER} collapsed={collapsed} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        {SIDEBAR_SECTIONS.map((section) => (
          <nav key={section.id} aria-label={section.label ?? "Chính"} className="flex flex-col gap-0.5">
            {section.label &&
              (collapsed ? (
                <div aria-hidden className="h-px bg-outline-subtle mx-2 my-1" />
              ) : (
                <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-on-surface-subtle">
                  {section.label}
                </div>
              ))}
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                active={item.status === "ready" && isSidebarItemActive(item, pathname)}
                count={item.status === "ready" && item.badge === "unread" ? unreadCount : 0}
                onNavigate={closeNav}
              />
            ))}
          </nav>
        ))}
        {!collapsed && <RecentProjects projects={recent} onNavigate={closeNav} />}
      </div>

      <div className="flex flex-col gap-1 pt-2 border-t border-outline-subtle">
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          title={collapsed ? "Gửi góp ý" : undefined}
          className={`flex items-center gap-2.5 rounded-[10px] text-[12.5px] font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            collapsed ? "justify-center h-9 w-9 mx-auto" : "h-9 px-2.5"
          }`}
        >
          <Icon name="feedback" size={17} />
          {collapsed ? <span className="sr-only">Gửi góp ý</span> : "Gửi góp ý"}
        </button>

        <DropdownMenu
          placement="top"
          header={
            <div className="flex items-center gap-2.5">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${AVATAR}`}>
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold text-on-surface truncate">{user.name}</span>
                <span className="block text-[10.5px] text-on-surface-muted truncate">{user.email}</span>
              </span>
            </div>
          }
          items={[
            {
              label: "Thanh toán",
              icon: "credit-card",
              onSelect: () => {
                closeNav();
                router.push("/home/billing");
              },
              trailing: <Badge>{planLabel}</Badge>,
            },
            { label: "Đăng xuất", icon: "logout", tone: "danger", onSelect: handleLogout },
          ]}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Tài khoản ${user.name}`}
              className={`flex items-center gap-2.5 w-full rounded-[12px] bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                collapsed ? "justify-center p-1.5" : "p-2"
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${AVATAR}`}>
                {initial}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-on-surface truncate">{user.name}</span>
                    <span className="block text-[10.5px] text-on-surface-muted truncate">{planLabel}</span>
                  </span>
                  <Icon name="chevron-down" size={14} className="text-on-surface-subtle" />
                </>
              )}
            </button>
          )}
        />
      </div>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </aside>
  );
}
