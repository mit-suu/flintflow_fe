import Link from "next/link";
import { SOON_LABEL } from "@/components/ui/Badge";
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

/**
 * Kiểu dòng dùng chung cho mọi mục của sidebar (nav, góp ý, tài khoản…). Sidebar là card trắng ⇒ hover là nền
 * xám rất nhạt, mục đang chọn là ô tím nhạt + chữ tím đậm (màu hệ thống).
 * `group/row` để tooltip của chế độ thu gọn bám theo dòng.
 */
export const SIDEBAR_ROW =
  "group/row relative flex items-center gap-3 rounded-control text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
export const SIDEBAR_ROW_IDLE = "text-on-surface-variant font-medium hover:bg-surface-sidebar hover:text-on-surface";
// Mục đang chọn: tím hệ thống — nền `primary-fixed` + chữ/icon `primary` (icon tô đặc)
const SIDEBAR_ROW_ACTIVE = "bg-primary-fixed text-primary font-semibold";

/** Kích thước dòng: thu gọn là ô vuông 40px giữa cột, mở rộng là hàng 40px. */
export const sidebarRowLayout = (collapsed: boolean) => (collapsed ? "justify-center h-10 w-10 mx-auto" : "h-10 px-3");

/** Tooltip nền tối bên phải icon khi sidebar thu gọn (thay cho nhãn bị ẩn). */
export function SidebarTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-inner bg-inverse-surface px-2.5 py-1 text-[12px] font-medium text-inverse-on-surface opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
    >
      {label}
    </span>
  );
}

/** Một dòng nav: icon + nhãn (+ số). Mục `soon` không phải link, không nhận focus, không bấm được. */
export default function SidebarNavItem({ item, active = false, collapsed = false, count = 0, onNavigate }: SidebarNavItemProps) {
  const layout = sidebarRowLayout(collapsed);

  if (item.status === "soon") {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? undefined : `${item.label} — ${SOON_LABEL}`}
        className={`${SIDEBAR_ROW} ${layout} font-medium text-on-surface-subtle cursor-not-allowed select-none`}
      >
        <Icon name={item.icon} size={19} />
        {collapsed ? (
          <>
            <span className="sr-only">
              {item.label} ({SOON_LABEL})
            </span>
            <SidebarTooltip label={`${item.label} · ${SOON_LABEL}`} />
          </>
        ) : (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {/* Chữ nhạt thay cho viên badge: tính năng chưa có không nên nổi hơn tính năng đang dùng được */}
            <span className="text-[11px] font-normal">{SOON_LABEL}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${SIDEBAR_ROW} ${layout} ${active ? SIDEBAR_ROW_ACTIVE : SIDEBAR_ROW_IDLE}`}
    >
      <Icon name={item.icon} size={19} weight={active ? "fill" : "regular"} />
      {collapsed ? (
        <>
          <span className="sr-only">{item.label}</span>
          {count > 0 && <span aria-hidden className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error" />}
          <SidebarTooltip label={item.label} />
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
