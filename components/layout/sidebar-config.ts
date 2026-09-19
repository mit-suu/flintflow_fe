import type { IconName } from "@/components/ui/Icon";

interface SidebarItemBase {
  id: string;
  label: string;
  icon: IconName;
}

/** Mục chạy được: có route. `badge: "unread"` ⇒ hiện số thông báo chưa đọc. */
export interface ReadySidebarItem extends SidebarItemBase {
  status: "ready";
  href: string;
  /** `exact`: chỉ active khi đúng route (Dự án ở `/home`); mặc định active cả route con. */
  match?: "exact" | "prefix";
  badge?: "unread";
}

/** Mục chưa có BE: hiện nhưng disabled + `Badge tone="soon"`. Có BE thì đổi sang `ready` + `href`. */
export interface SoonSidebarItem extends SidebarItemBase {
  status: "soon";
}

export type SidebarItem = ReadySidebarItem | SoonSidebarItem;

export interface SidebarSection {
  id: string;
  /** Tiêu đề nhóm (in hoa); không có ⇒ nhóm nav chính. */
  label?: string;
  items: readonly SidebarItem[];
}

/** Ô đổi tổ chức dưới logo — BE chưa có module org. */
export const ORG_SWITCHER: SidebarItem = { id: "org-switcher", label: "Đổi tổ chức", icon: "building", status: "soon" };

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: "main",
    items: [
      { id: "projects", label: "Dự án", icon: "layers", status: "ready", href: "/home", match: "exact" },
      { id: "notifications", label: "Thông báo", icon: "bell", status: "ready", href: "/home/notifications", badge: "unread" },
    ],
  },
  {
    id: "org",
    label: "Tổ chức",
    items: [
      { id: "members", label: "Thành viên", icon: "users", status: "soon" },
      { id: "billing", label: "Credits & Thanh toán", icon: "credit-card", status: "ready", href: "/home/billing" },
    ],
  },
];

export const isSidebarItemActive = (item: ReadySidebarItem, pathname: string): boolean =>
  item.match === "exact" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
