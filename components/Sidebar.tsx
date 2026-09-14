"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAuthToken } from "../lib/auth";
import Logo from "./Logo";

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
}

interface SidebarProps {
  activePath: string;
  user: SidebarUser;
  favourites?: Project[];
  notificationCount?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Trang chủ", href: "/home", icon: "⌂" },
  { label: "Dự án của tôi", href: "/home", icon: "◫" },
  { label: "Thông báo", href: "/home/notifications", icon: "◉" },
  { label: "Thanh toán & credit", href: "/home/billing", icon: "◎" },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#C7B8F5,#4F46E5)",
  "linear-gradient(135deg,#9BD9B4,#4FAE78)",
  "linear-gradient(135deg,#F2C572,#E8A23D)",
  "linear-gradient(135deg,#F5B8C7,#E54F6D)",
  "linear-gradient(135deg,#B8D9F5,#4F7AE5)",
];

function userAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

export default function Sidebar({
  activePath,
  user,
  favourites = [],
  notificationCount = 0,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    clearAuthToken();
    router.push("/login");
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
        const isActive = idx === 1 ? activePath === "/home" || activePath.startsWith("/home/projects") : activePath === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-2.5 rounded-[10px] text-[12px] transition-colors ${
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
            <div className="flex items-center gap-2.5 p-2.5 pb-3">
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
            </div>

            <div className="h-px bg-[#F0EEEA] mx-1.5 my-1" />

            <button
              type="button"
              onClick={() => router.push("/home/billing")}
              className="flex items-center gap-2.5 p-2 rounded-[9px] text-[12px] text-[#33312D] font-semibold hover:bg-[#FAF9F7] transition-colors w-full text-left"
            >
              ◎ Thanh toán
              <span className="ml-auto px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[10px] font-bold text-[#6B6862]">
                {user.plan}
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
          className="flex items-center gap-2.5 p-2.5 rounded-[12px] bg-[#FAF9F7] hover:bg-[#F0EEEA] cursor-pointer transition-colors"
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
                <div className="text-[10px] text-[#8A867E] truncate">{user.plan}</div>
              </div>
              <div className="ml-auto text-[#A8A49C] text-[11px]">⌄</div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
