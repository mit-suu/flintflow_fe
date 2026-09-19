"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { useAppShell } from "./AppShell";

interface TopBarProps {
  /** Breadcrumb; phần tử cuối là trang hiện tại. */
  trail: readonly string[];
  /** Ô tìm kiếm — chỉ trang cần mới truyền. */
  search?: ReactNode;
  /** Nút hành động bên phải (vd. "+ Dự án mới"). */
  actions?: ReactNode;
}

/** Thanh trên của mọi trang `/home/*`: nút mở menu (mobile), breadcrumb, search, chip credits, action. */
export default function TopBar({ trail, search, actions }: TopBarProps) {
  const { openNav, balance } = useAppShell();
  const current = trail[trail.length - 1];

  return (
    <header className="shrink-0 bg-surface-container-lowest">
      <div className="min-h-[58px] flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-2.5">
        <IconButton icon="menu" label="Mở menu" onClick={openNav} className="md:hidden -ml-1" />

        <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1.5 text-[13px]">
          {trail.slice(0, -1).map((part) => (
            <span key={part} className="hidden sm:flex items-center gap-1.5 text-on-surface-muted">
              {part}
              <span aria-hidden className="text-on-surface-subtle">/</span>
            </span>
          ))}
          <span aria-current="page" className="font-bold text-on-surface truncate">
            {current}
          </span>
        </nav>

        {/* Một ô duy nhất: mobile xuống dòng riêng (order-last), desktop nằm giữa hàng */}
        {search && <div className="order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-[320px] md:ml-4">{search}</div>}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {balance && (
            <Link
              href="/home/billing"
              title="Credits & Thanh toán"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-control bg-surface-container-high text-[12px] font-semibold text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <Icon name="wallet" size={14} className="text-primary" />
              <span className="tabular-nums">{balance.balance.toLocaleString("vi-VN")}</span>
              <span className="text-on-surface-muted">credits · {balance.planLabel}</span>
            </Link>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
