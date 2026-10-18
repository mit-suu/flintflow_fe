"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { House, LogOut } from "lucide-react";
import { fetchMe } from "@/lib/api/users";
import { logoutAndRedirect } from "@/lib/auth";
import type { User } from "@/types/user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

/** Hai chữ cái đầu của tên (hoặc của email khi chưa đặt tên) cho avatar chữ. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminProfileMenu() {
  const [me, setMe] = useState<User | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Hỏng thì vẫn hiện menu với avatar mặc định — không chặn thao tác quản trị vì một cái tên.
    fetchMe()
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = me?.name || me?.email || "Quản trị viên";
  const email = me?.email ?? "";

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="Tài khoản" className="relative size-8 rounded-full p-0">
            <Avatar className="size-8">
              <AvatarFallback className="bg-accent text-accent-foreground text-caption font-bold">
                {initialsOf(displayName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5">
              <p className="text-body leading-none font-medium">{displayName}</p>
              {email && <p className="text-muted-foreground text-caption leading-none">{email}</p>}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/home">
              <House />
              Về Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmingSignOut(true)}>
            <LogOut />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingSignOut} onOpenChange={setConfirmingSignOut}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Đăng xuất</AlertDialogTitle>
            <AlertDialogDescription>
              Đăng xuất khỏi trang quản trị? Lần sau vào lại phải đăng nhập.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void logoutAndRedirect()}>Đăng xuất</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
