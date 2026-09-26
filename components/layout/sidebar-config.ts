import type { IconName } from "@/components/ui/Icon";

/** `id` vừa là khoá React vừa là key nhãn trong `app.shell.items.*` — thêm mục thì thêm key ở cả hai bản messages. */
export type SidebarItemId = "projects" | "notifications" | "orgSwitcher" | "members" | "billing";

interface SidebarItemBase {
  id: SidebarItemId;
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
  /** Key tiêu đề nhóm trong `app.shell` (vd `sectionOrg`); không có ⇒ nhóm nav chính. */
  labelKey?: "sectionOrg";
  items: readonly SidebarItem[];
}

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: "main",
    items: [
      { id: "projects", icon: "layers", status: "ready", href: "/home", match: "exact" },
      { id: "notifications", icon: "bell", status: "ready", href: "/home/notifications", badge: "unread" },
    ],
  },
  {
    id: "org",
    labelKey: "sectionOrg",
    // Đổi tổ chức nằm trong nhóm Tổ chức — không chiếm vị trí đầu sidebar (task-26: BE đã có module org)
    items: [
      { id: "orgSwitcher", icon: "building", status: "ready", href: "/home/organizations" },
      { id: "members", icon: "users", status: "ready", href: "/home/members" },
      { id: "billing", icon: "credit-card", status: "ready", href: "/home/billing" },
    ],
  },
];

export const isSidebarItemActive = (item: ReadySidebarItem, pathname: string): boolean =>
  item.match === "exact" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
