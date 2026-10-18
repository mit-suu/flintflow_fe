"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { useUnreadNotificationCount } from "@/components/NotificationBell";
import FeedbackDialog from "@/components/project/FeedbackDialog";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { selectRecentProjects, useProjects } from "@/lib/hooks/use-projects";
import { useActiveOrganization } from "@/lib/hooks/use-active-org";
import { useAppShell } from "./AppShell";
import OrgSwitcher from "./OrgSwitcher";
import RecentProjects from "./RecentProjects";
import SidebarNavItem, {
  SIDEBAR_ROW,
  SIDEBAR_ROW_IDLE,
  SidebarTooltip,
  sidebarRowLayout
} from "./SidebarNavItem";
import { SIDEBAR_SECTIONS, isSidebarItemActive } from "./sidebar-config";

export default function AppSidebar() {
  const t = useTranslations("app.shell");
  const pathname = usePathname();
  const {
    navOpen,
    closeNav,
    collapsed: collapsedPref,
    toggleCollapsed
  } = useAppShell();
  const { projects } = useProjects();
  const unreadCount = useUnreadNotificationCount();
  const activeOrg = useActiveOrganization();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Drawer mobile luôn mở rộng; thu gọn chỉ áp dụng trên desktop
  const collapsed = collapsedPref && !navOpen;
  const recent = selectRecentProjects(projects);

  return (
    // Cột nền xám nhạt, bên trong là một card trắng bo góc nổi lên (sidebar kiểu "floating panel")
    <aside
      aria-label={t("nav")}
      className="h-dvh bg-surface-sidebar p-3 pl-0 pr-4 rounded-r-2xl">
      <div
        // Bấm vào VÙNG TRỐNG của sidebar (không phải link/nút/menu/mục "Sắp có") ⇒ thu gọn/mở rộng — chỉ desktop.
        // Bàn phím vẫn dùng nút tròn ở mép phải; vùng trống không nhận focus nên không cần phím riêng.
        onClick={(e) => {
          if (navOpen) return;
          if ((e.target as HTMLElement).closest("a, button, input, textarea, select, label, [role], [aria-disabled]")) return;
          toggleCollapsed();
        }}
        className={`relative h-full flex flex-col rounded-r-[20px] bg-surface-container-lowest shadow-[0_1px_2px_rgba(25,24,23,0.04),0_8px_24px_rgba(25,24,23,0.05)] py-4 transition-[width] duration-200 ${
          collapsed ? "w-[64px] px-2 md:cursor-e-resize" : "w-[232px] px-3 md:cursor-w-resize"
        }`}>
        {/* Nút tròn nằm đè lên mép phải card, ở GIỮA chiều cao — chỉ desktop (mobile có nút đóng riêng) */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("expand") : t("collapse")}
          title={collapsed ? t("expand") : t("collapse")}
          className="hidden md:grid absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 place-items-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-[0_1px_3px_rgba(25,24,23,0.14)] hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Icon
            name={collapsed ? "caret-right" : "caret-left"}
            size={13}
            weight="bold"
          />
        </button>

        {/* Logo: mở rộng = wordmark (bản 2026-09 — chữ "Flow" tím dịu khớp primary #6a62c4); thu gọn = icon chữ F. */}
        <div
          className={`flex items-center h-11 mb-5 gap-2 pt-3 ${collapsed ? "justify-center" : "px-5"}`}>
          {/* Luôn render CẢ HAI logo, chỉ ẩn/hiện bằng CSS: ảnh bị ẩn vẫn được trình duyệt tải sẵn ⇒ bấm thu gọn/mở rộng
              là đổi logo ngay. Mount có điều kiện thì ảnh chỉ bắt đầu tải lúc bấm ⇒ logo đổi trễ. */}
          <Logo
            variant="icon"
            sizeClassName="w-7 h-7"
            theme="light"
            className={collapsed ? "" : "hidden"}
          />
          <Logo
            variant="wordmark"
            sizeClassName="h-5 w-auto"
            theme="light"
            className={collapsed ? "hidden" : ""}
          />
          {!collapsed && (
            <IconButton
              icon="close"
              label={t("closeMenu")}
              size="sm"
              onClick={closeNav}
              className="ml-auto md:hidden"
              data-autofocus
            />
          )}
        </div>

        {/* Thu gọn: không cuộn để tooltip bên phải icon không bị cắt (ít mục, không cần cuộn) */}
        <div
          className={`flex-1 min-h-0 flex flex-col gap-6 ${collapsed ? "overflow-visible" : "ff-scroll overflow-y-auto"}`}>
          {SIDEBAR_SECTIONS.map((section) => (
            <nav
              key={section.id}
              aria-label={section.labelKey ? t(section.labelKey) : t("sectionMain")}
              className="flex flex-col gap-1">
              {section.labelKey &&
                (collapsed ? (
                  <div
                    aria-hidden
                    className="h-px bg-on-surface/[0.07] mx-2 mb-2"
                  />
                ) : (
                  <div className="px-3 pb-1">
                    <div className="text-body font-medium text-on-surface-muted">{t(section.labelKey)}</div>
                  </div>
                ))}
              {/* Tổ chức đang mở, bấm được để đổi sang tổ chức khác hoặc tạo/tham gia tổ chức mới. Chưa biết tổ
                  chức (đang tải / chưa có) thì không dựng gì — không có chỗ nào để đổi tới. */}
              {section.id === "org" && activeOrg ? (
                <OrgSwitcher activeOrg={activeOrg} collapsed={collapsed} />
              ) : null}
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={
                    item.status === "ready" &&
                    isSidebarItemActive(item, pathname)
                  }
                  count={
                    item.status === "ready" && item.badge === "unread"
                      ? unreadCount
                      : 0
                  }
                  onNavigate={closeNav}
                />
              ))}
            </nav>
          ))}
          {!collapsed && (
            <RecentProjects
              projects={recent}
              onNavigate={closeNav}
            />
          )}
        </div>

        <div className="flex flex-col gap-1 pt-3">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={`${SIDEBAR_ROW} ${SIDEBAR_ROW_IDLE} cursor-pointer ${sidebarRowLayout(collapsed)}`}>
            <Icon
              name="feedback"
              size={19}
            />
            {collapsed ? (
              <>
                <span className="sr-only">{t("feedback")}</span>
                <SidebarTooltip label={t("feedback")} />
              </>
            ) : (
              t("feedback")
            )}
          </button>

        </div>
      </div>

      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </aside>
  );
}
