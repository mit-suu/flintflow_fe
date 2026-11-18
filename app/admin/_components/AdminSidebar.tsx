"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/shadcn/sidebar";
import { ADMIN_NAV } from "./admin-nav";

export default function AdminSidebar() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const { setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const closeOnMobile = () => setOpenMobile(false);

  return (
    // `inset` = mặc định của bộ admin gốc: vùng nội dung là một tấm bo góc nổi trên nền sidebar.
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Logo đúng bản của khu người dùng: mở rộng là wordmark màu, thu gọn là icon chữ F. */}
            <SidebarMenuButton
              size="lg"
              asChild
              className={cn("gap-0 py-0 hover:bg-transparent active:bg-transparent", isCollapsed && "justify-center")}
            >
              <Link href="/admin/metrics" onClick={closeOnMobile}>
                {isCollapsed ? (
                  <Logo variant="icon" theme="light" sizeClassName="size-7 shrink-0" />
                ) : (
                  <div className="grid gap-0.5">
                    <Logo variant="wordmark" theme="light" sizeClassName="h-5 w-auto" />
                    <span className="text-on-surface-muted text-caption font-semibold">{t("subtitle")}</span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAV.map((group) => (
          <SidebarGroup key={group.titleKey}>
            <SidebarGroupLabel>{t(`groups.${group.titleKey}`)}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(`items.${item.labelKey}`)}
                      // Cùng nhịp với sidebar khu người dùng: hàng 40px, bo `control`, icon 20px.
                      // Hover là xám nhạt, chỉ mục đang chọn mới là ô tím — để hai trạng thái không lẫn nhau.
                      className={cn(
                        "h-10 gap-3 rounded-control text-body [&>svg]:size-5",
                        "hover:bg-muted hover:text-foreground",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold"
                      )}
                    >
                      <Link href={item.href} onClick={closeOnMobile}>
                        <item.icon />
                        <span>{t(`items.${item.labelKey}`)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
