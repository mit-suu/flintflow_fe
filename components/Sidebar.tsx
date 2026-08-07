"use client";

import { useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  avatarGradient?: string;
}

interface SidebarUser {
  name: string;
  plan: string;
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
  { label: "Home",             href: "/home",              icon: "⌂" },
  { label: "My Projects",      href: "/home/projects",     icon: "◫" },
  { label: "Templates",        href: "/home/templates",    icon: "▤" },
  { label: "Export & Handoff", href: "/home/export",       icon: "↗" },
  { label: "Billing",          href: "/home/billing",      icon: "◎" },
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

  return (
    <aside
      className="shrink-0 bg-white border-r border-[#ECEAE5] flex flex-col gap-1 py-[26px] min-h-screen transition-all duration-200"
      style={{
        width: collapsed ? 68 : 264,
        padding: collapsed ? "26px 10px" : "26px 18px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Logo row */}
      <div
        className="flex items-center gap-[10px] pb-[22px]"
        style={{ paddingLeft: collapsed ? 6 : 10, paddingRight: collapsed ? 6 : 10 }}
      >
        <div
          className="w-8 h-8 rounded-[11px] flex items-center justify-center text-white text-[16px] font-[800] shrink-0 shadow-[0_6px_16px_rgba(79,70,229,0.3)]"
          style={{ background: "linear-gradient(135deg,#7C74F0,#4F46E5)" }}
        >
          F
        </div>
        {!collapsed && (
          <span className="text-[17px] font-[800] text-[#191817] truncate">FlintFlow</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#A8A49C] hover:text-[#191817] transition-colors select-none"
          style={{ marginLeft: collapsed ? "auto" : "auto", fontSize: 16 }}
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = activePath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-[11px] rounded-[12px] text-[14px] transition-colors ${
              isActive
                ? "bg-[#F4F3FE] text-[#3B34B0] font-[700]"
                : "text-[#6B6862] font-[600] hover:bg-[#F5F3F0]"
            }`}
            style={{
              padding: collapsed ? "11px 0" : "11px 14px",
              justifyContent: collapsed ? "center" : undefined,
            }}
          >
            <span className="text-[15px] leading-none shrink-0">{item.icon}</span>
            {!collapsed && item.label}
          </Link>
        );
      })}

      {/* Divider */}
      <div className="h-px bg-[#F0EEEA] mx-[4px] my-[14px]" />

      {/* Notifications */}
      <button
        type="button"
        title={collapsed ? "Notifications" : undefined}
        className="flex items-center gap-[11px] rounded-[12px] text-[14px] text-[#6B6862] font-[600] hover:bg-[#F5F3F0] transition-colors w-full text-left"
        style={{
          padding: collapsed ? "11px 0" : "11px 14px",
          justifyContent: collapsed ? "center" : undefined,
        }}
      >
        <span className="text-[15px] leading-none shrink-0">🔔</span>
        {!collapsed && (
          <>
            Notifications
            {notificationCount > 0 && (
              <span
                className="ml-auto flex items-center justify-center text-white font-[800] rounded-full"
                style={{ width: 22, height: 22, fontSize: 11.5, background: "#C73E3E" }}
              >
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            )}
          </>
        )}
        {collapsed && notificationCount > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C73E3E]"
          />
        )}
      </button>

      {/* Favourites */}
      {!collapsed && favourites.length > 0 && (
        <>
          <div className="h-px bg-[#F0EEEA] mx-[10px] my-[14px]" />
          <p
            className="text-[#A8A49C] font-[800] uppercase px-[14px] pt-[4px] pb-[8px]"
            style={{ fontSize: 11.5, letterSpacing: "0.06em" }}
          >
            Favourites
          </p>
          {favourites.map((project) => (
            <Link
              key={project.id}
              href={`/home/projects/${project.id}`}
              className="flex items-center gap-[11px] px-[14px] py-[9px] text-[13.5px] text-[#33312D] font-[600] hover:bg-[#F5F3F0] rounded-[12px] transition-colors"
            >
              <span
                className="w-[26px] h-[26px] rounded-[8px] shrink-0"
                style={{
                  background:
                    project.avatarGradient ??
                    AVATAR_GRADIENTS[project.name.charCodeAt(0) % AVATAR_GRADIENTS.length],
                }}
              />
              <span className="flex-1 truncate">{project.name}</span>
              <span style={{ marginLeft: "auto", color: "#E8A23D" }}>★</span>
            </Link>
          ))}
        </>
      )}

      {/* User card — pinned to bottom */}
      <div
        className="flex items-center gap-[11px] rounded-[14px] bg-[#FAF9F7]"
        style={{
          marginTop: "auto",
          padding: collapsed ? "10px 8px" : "12px 14px",
          justifyContent: collapsed ? "center" : undefined,
        }}
        title={collapsed ? `${user.name} · ${user.plan}` : undefined}
      >
        <div
          className="w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ background: userAvatarGradient(user.name) }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div>
            <p className="text-[#191817] font-[700]" style={{ fontSize: 13.5 }}>
              {user.name}
            </p>
            <p className="text-[#8A867E]" style={{ fontSize: 11.5 }}>
              {user.plan}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
