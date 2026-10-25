"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/shadcn/separator";
import { SidebarTrigger } from "@/components/shadcn/sidebar";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AdminProfileMenu from "./AdminProfileMenu";
import { AdminSearchButton } from "./AdminSearch";

/**
 * Thanh đầu dùng chung cho mọi trang admin: nút thu/mở sidebar, ô tìm trang (⌘K), nút đổi VI/EN và menu tài khoản.
 * Dính trên đỉnh; cuộn xuống thì nền mờ để chữ của trang không đè lên.
 */
export default function AdminHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled((document.body.scrollTop || document.documentElement.scrollTop) > 10);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 w-[inherit] shrink-0">
      <div
        className={cn(
          "relative flex h-full items-center gap-3 px-4 sm:gap-4",
          scrolled && "after:bg-background/60 after:absolute after:inset-0 after:-z-10 after:backdrop-blur-lg"
        )}
      >
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="h-6" />
        <AdminSearchButton />
        <div className="ms-auto flex items-center gap-3">
          <LocaleSwitcher />
          <AdminProfileMenu />
        </div>
      </div>
    </header>
  );
}
