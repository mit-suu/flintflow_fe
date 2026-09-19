import Link from "next/link";
import Badge, { SOON_LABEL } from "@/components/ui/Badge";
import CountBadge from "@/components/ui/CountBadge";
import Icon from "@/components/ui/Icon";
import type { SidebarItem } from "./sidebar-config";

interface SidebarNavItemProps {
  item: SidebarItem;
  active?: boolean;
  collapsed?: boolean;
  /** Số hiện bên phải (thông báo chưa đọc); 0 ⇒ ẩn. */
  count?: number;
  /** Bấm một mục dẫn trang (đóng drawer trên mobile). */
  onNavigate?: () => void;
}

const BASE = "relative flex items-center gap-2.5 rounded-[10px] text-[12.5px] transition-colors";

/** Một dòng nav: icon + nhãn + badge. Mục `soon` không phải link, không nhận focus, không bấm được. */
export default function SidebarNavItem({ item, active = false, collapsed = false, count = 0, onNavigate }: SidebarNavItemProps) {
  const layout = collapsed ? "justify-center h-9 w-9 mx-auto" : "h-9 px-2.5";

  if (item.status === "soon") {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} — ${SOON_LABEL}`}
        className={`${BASE} ${layout} font-semibold text-on-surface-subtle cursor-not-allowed select-none`}
      >
        <Icon name={item.icon} size={17} />
        {collapsed ? (
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-on-surface-subtle" />
        ) : (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <Badge tone="soon" />
          </>
        )}
        {collapsed && <span className="sr-only">{item.label} ({SOON_LABEL})</span>}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`${BASE} ${layout} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "bg-primary-soft text-primary-hover font-bold"
          : "text-on-surface-variant font-semibold hover:bg-surface-container-low hover:text-on-surface"
      }`}
    >
      <Icon name={item.icon} size={17} />
      {collapsed ? (
        <>
          <span className="sr-only">{item.label}</span>
          {count > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />}
        </>
      ) : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 && <CountBadge count={count} tone="alert" />}
        </>
      )}
    </Link>
  );
}
