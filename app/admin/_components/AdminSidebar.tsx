"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { logoutAndRedirect } from "@/lib/auth";

const NAV_ITEMS = [
  { label: "Số liệu", href: "/admin/metrics", icon: "▦" },
  { label: "Người dùng", href: "/admin/users", icon: "◉" },
  { label: "Chi phí AI", href: "/admin/ai-cost", icon: "◎" },
  { label: "Phản hồi", href: "/admin/feedback", icon: "✉" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    void logoutAndRedirect();
  };

  return (
    <aside className="shrink-0 w-[216px] bg-white border-r border-[#ECEAE5] flex flex-col gap-1 px-3.5 py-4.5 min-h-screen">
      <div className="flex items-center gap-2 px-2 pb-1">
        <Logo
          variant="wordmark"
          sizeClassName="h-4 w-auto"
          theme="light"
        />
      </div>
      <div className="px-2.5 pb-3 text-[10px] font-extrabold text-[#A8A49C] tracking-[0.06em] uppercase">
        Quản trị
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] transition-colors ${
              isActive ? "bg-[#F4F3FE] text-[#3B34B0] font-bold" : "text-[#6B6862] font-semibold hover:bg-[#FAF9F7]"
            }`}
          >
            <span className="text-[13px] leading-none shrink-0">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col gap-1">
        <div className="h-px bg-[#F0EEEA] mx-2 my-2" />
        <Link
          href="/home"
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] text-[#6B6862] font-semibold hover:bg-[#FAF9F7]"
        >
          <span className="text-[13px] leading-none">⌂</span>
          Về Dashboard
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] text-[#B03030] font-bold hover:bg-[#FDEDED] text-left cursor-pointer"
        >
          <span className="text-[13px] leading-none">⏻</span>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
