import type { useTranslations } from "next-intl";
import { Building2, ChartColumnIncreasing, Coins, FileStack, MessageSquareText, Users, type LucideIcon } from "lucide-react";

/** Translator của namespace `admin` — truyền vào các hàm dựng cột/nhãn (không gọi hook được ngoài component). */
export type AdminT = ReturnType<typeof useTranslations<"admin">>;

export interface AdminNavItem {
  /** Key dưới `admin.nav.items` — component dịch lúc render. */
  labelKey: "metrics" | "users" | "orgs" | "aiCost" | "feedback" | "templateGaps";
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  /** Key dưới `admin.nav.groups`. */
  titleKey: "operations" | "system";
  items: AdminNavItem[];
}

/** Một nguồn cho cả sidebar và bảng lệnh ⌘K — thêm trang mới chỉ sửa ở đây (và thêm nhãn vào `admin.nav`). */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    titleKey: "operations",
    items: [
      { labelKey: "metrics", href: "/admin/metrics", icon: ChartColumnIncreasing },
      { labelKey: "users", href: "/admin/users", icon: Users },
      { labelKey: "orgs", href: "/admin/orgs", icon: Building2 },
    ],
  },
  {
    titleKey: "system",
    items: [
      { labelKey: "aiCost", href: "/admin/ai-cost", icon: Coins },
      { labelKey: "feedback", href: "/admin/feedback", icon: MessageSquareText },
      { labelKey: "templateGaps", href: "/admin/template-gaps", icon: FileStack },
    ],
  },
];
