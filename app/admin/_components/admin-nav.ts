import { Building2, ChartColumnIncreasing, Coins, MessageSquareText, Users, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/** Một nguồn cho cả sidebar và bảng lệnh ⌘K — thêm trang mới chỉ sửa ở đây. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Vận hành",
    items: [
      { label: "Số liệu", href: "/admin/metrics", icon: ChartColumnIncreasing },
      { label: "Người dùng", href: "/admin/users", icon: Users },
      { label: "Tổ chức", href: "/admin/orgs", icon: Building2 },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { label: "Chi phí AI", href: "/admin/ai-cost", icon: Coins },
      { label: "Phản hồi", href: "/admin/feedback", icon: MessageSquareText },
    ],
  },
];
