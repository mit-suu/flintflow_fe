"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAndRedirect } from "../lib/auth";
import { fetchBalance } from "../lib/api/billing";
import Logo from "./Logo";
import { useUnreadNotificationCount } from "./NotificationBell";

interface Project {
  id: string;
  name: string;
  avatarGradient?: string;
}

interface SidebarUser {
  name: string;
  plan: string;
  email?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Hiện badge số thông báo chưa đọc. */
  showUnreadBadge?: boolean;
  /** Chỉ sáng khi đúng đường dẫn, không tính trang con (`/home` không sáng ở `/home/profile`). */
  exact?: boolean;
}

interface SidebarProps {
  user: SidebarUser;
  favourites?: Project[];
  notificationCount?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Trang chủ", href: "/home", icon: "⌂", exact: true },
  { label: "Dự án của tôi", href: "/home", icon: "◫", exact: true },
  { label: "Thông báo", href: "/home/notifications", icon: "◉", showUnreadBadge: true },
  { label: "Thanh toán & credit", href: "/home/billing", icon: "◎" },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#C7B8F5,#4F46E5)",
  "linear-gradient(135deg,#9BD9B4,#4FAE78)",
  "linear-gradient(135deg,#F2C572,#E8A23D)",
  "linear-gradient(135deg,#F5B8C7,#E54F6D)",
  "linear-gradient(135deg,#B8D9F5,#4F7AE5)",
];

export function userAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

/**
 * Mục đang mở = mục có `href` khớp dài nhất với trang hiện tại (`/home/billing/checkout` ⇒ "Thanh toán").
 * Nhiều mục cùng `href` (Trang chủ, Dự án của tôi đều là `/home`) thì chỉ tô mục đầu tiên.
 */
export function findActiveNavIndex(pathname: string, items: NavItem[] = NAV_ITEMS): number {
  let best = -1;
  items.forEach((item, idx) => {
    const matches = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
    if (matches && (best === -1 || item.href.length > items[best].href.length)) best = idx;
  });
  return best;
}

const PROFILE_PATH = "/home/profile";

export default function Sidebar({
  user,
  favourites = [],
  notificationCount,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const activeNavIndex = findActiveNavIndex(pathname);
  const onProfilePage = pathname === PROFILE_PATH;
  const liveUnreadCount = useUnreadNotificationCount();
  const unreadCount = notificationCount ?? liveUnreadCount;
  // Nhãn plan lấy từ /billing/balance; admin giữ nhãn "Admin"
  const displayPlan = user.plan === "Admin" ? user.plan : planLabel ?? user.plan;

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      try {
        const balance = await fetchBalance();
        if (!cancelled) setPlanLabel(`${balance.planLabel} Plan`);
      } catch {
        // Giữ nhãn mặc định từ layout
      }
    };
    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    void logoutAndRedirect();
  };

  return (
    <aside
      className="shrink-0 bg-white border-r border-[#ECEAE5] flex flex-col gap-1 py-4.5 min-h-screen transition-all duration-200 z-30"
      style={{
        width: collapsed ? 68 : 216,
        padding: collapsed ? "18px 10px" : "18px 14px",
      }}
    >
      {/* Logo row */}
      <div
        className="flex items-center gap-2 pb-4"
        style={{ paddingLeft: collapsed ? 4 : 8, paddingRight: collapsed ? 4 : 8 }}
      >
        <Logo
          sizeClassName="w-6.5 h-6.5"
          showText={!collapsed}
          textClassName="text-[14px] font-extrabold text-[#191817] truncate"
          theme="light"
        />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#A8A49C] hover:text-[#191817] transition-colors select-none text-[13px] ml-auto cursor-pointer"
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item, idx) => {
        const isActive = idx === activeNavIndex;
        return (
          <Link
            key={item.label}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex items-center gap-2.5 rounded-[10px] text-[12px] transition-colors ${
              isActive
                ? "bg-[#F4F3FE] text-[#3B34B0] font-bold"
                : "text-[#6B6862] font-semibold hover:bg-[#FAF9F7]"
            }`}
            style={{
              padding: collapsed ? "8px 0" : "8px 10px",
              justifyContent: collapsed ? "center" : undefined,
            }}
          >
            <span className="text-[13px] leading-none shrink-0">{item.icon}</span>
            {!collapsed && item.label}
            {item.showUnreadBadge && unreadCount > 0 && (
              <span
                className={`min-w-[16px] h-[16px] rounded-full bg-[#B03030] text-white text-[9.5px] font-extrabold flex items-center justify-center px-1 ${
                  collapsed ? "absolute top-0.5 right-1" : "ml-auto"
                }`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}

      {/* Divider */}
      <div className="h-px bg-[#F0EEEA] mx-2 my-2.5" />

      {/* Favourites Section */}
      {!collapsed && (
        <>
          <div className="text-[10px] font-extrabold text-[#A8A49C] tracking-[0.06em] px-2.5 pt-0.5 pb-1.5 uppercase">
            Dự án yêu thích
          </div>
          {favourites.length > 0 ? (
            favourites.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-2.5 px-2.5 py-1.5 text-[11.5px] text-[#33312D] font-semibold hover:bg-[#FAF9F7] rounded-[8px] transition-colors"
              >
                <span
                  className="w-5 h-5 rounded-[7px] shrink-0"
                  style={{
                    background:
                      project.avatarGradient ??
                      AVATAR_GRADIENTS[project.name.charCodeAt(0) % AVATAR_GRADIENTS.length],
                  }}
                />
                <span className="flex-1 truncate">{project.name}</span>
                <span className="text-[#E8A23D] text-[11px] ml-auto">★</span>
              </Link>
            ))
          ) : (
            <div className="px-2.5 py-1 text-[11px] text-[#A8A49C] italic">
              Chưa có dự án yêu thích
            </div>
          )}
        </>
      )}

      {/* User menu — pinned to bottom */}
      <div style={{ marginTop: "auto" }} className="relative" ref={userMenuRef}>
        {/* User Dropdown Menu (B1 Design) */}
        {userMenuOpen && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 bg-white border border-[#ECEAE5] rounded-[14px] shadow-[0_16px_42px_rgba(25,24,23,0.18)] p-1.5 flex flex-col gap-0.5 z-40">
            <Link
              href={PROFILE_PATH}
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 p-2.5 pb-3 rounded-[9px] hover:bg-[#FAF9F7] transition-colors"
            >
              <div
                className="w-8.5 h-8.5 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: userAvatarGradient(user.name) }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-extrabold text-[#191817] truncate">{user.name}</div>
                <div className="text-[10.5px] text-[#8A867E] truncate">{user.email || `${user.name.toLowerCase()}@flintflow.com`}</div>
              </div>
            </Link>

            <div className="h-px bg-[#F0EEEA] mx-1.5 my-1" />

            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                router.push(PROFILE_PATH);
              }}
              className={`flex items-center gap-2.5 p-2 rounded-[9px] text-[12px] transition-colors w-full text-left ${
                onProfilePage
                  ? "bg-[#F4F3FE] text-[#3B34B0] font-bold"
                  : "text-[#33312D] font-semibold hover:bg-[#FAF9F7]"
              }`}
            >
              ◉ Hồ sơ cá nhân
            </button>

            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                router.push("/home/billing");
              }}
              className="flex items-center gap-2.5 p-2 rounded-[9px] text-[12px] text-[#33312D] font-semibold hover:bg-[#FAF9F7] transition-colors w-full text-left"
            >
              ◎ Thanh toán
              <span className="ml-auto px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[10px] font-bold text-[#6B6862]">
                {displayPlan}
              </span>
            </button>

            <div className="h-px bg-[#F0EEEA] mx-1.5 my-1" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 p-2 rounded-[9px] text-[12px] text-[#B03030] font-bold hover:bg-[#FDEDED] transition-colors w-full text-left"
            >
              ⏻ Đăng xuất
            </button>
          </div>
        )}

        {/* Collapsed Pill (Click to open menu) */}
        <div
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          aria-current={onProfilePage ? "page" : undefined}
          className={`flex items-center gap-2.5 p-2.5 rounded-[12px] cursor-pointer transition-colors ${
            onProfilePage
              ? "bg-[#F4F3FE] ring-1 ring-[#DDD9F6] hover:bg-[#ECEAFD]"
              : "bg-[#FAF9F7] hover:bg-[#F0EEEA]"
          }`}
          style={{
            justifyContent: collapsed ? "center" : undefined,
          }}
        >
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ background: userAvatarGradient(user.name) }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0">
                <div className="text-[11.5px] font-bold text-[#191817] truncate">{user.name}</div>
                <div className="text-[10px] text-[#8A867E] truncate">{displayPlan}</div>
              </div>
              <div className="ml-auto text-[#A8A49C] text-[11px]">⌄</div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
