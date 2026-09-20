"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useDialogFocus } from "@/lib/hooks/use-dialog-focus";
import { fetchBalance, type BalanceResponse } from "@/lib/api/billing";

interface AppShellContextValue {
  navOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  /** Sidebar thu gọn trên desktop (nhớ bằng localStorage). */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** `GET /billing/balance` — chip credits ở top bar và nhãn gói ở menu user; `null` khi chưa tải/lỗi. */
  balance: BalanceResponse | null;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

// ─── trạng thái thu gọn: localStorage, đọc qua useSyncExternalStore (không setState trong effect) ───

const COLLAPSED_KEY = "ff.sidebar.collapsed";
const COLLAPSED_EVENT = "ff:sidebar-collapsed";

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false; // storage bị chặn (private mode): mặc định mở rộng
  }
};

const writeCollapsed = (value: boolean) => {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Không lưu được thì chỉ mất ghi nhớ, vẫn đổi trong phiên này qua sự kiện bên dưới
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
};

const subscribeCollapsed = (onChange: () => void) => {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

let sessionCollapsed: boolean | null = null;
const getCollapsedSnapshot = () => sessionCollapsed ?? readCollapsed();

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Khung chung của `/home/*`: sidebar trái (drawer trên mobile < md) + vùng nội dung. Trang tự render
 * `TopBar` của mình ở đầu nội dung.
 */
export default function AppShell({ sidebar, children }: AppShellProps) {
  const t = useTranslations("app.shell");
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, () => false);

  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleCollapsed = useCallback(() => {
    sessionCollapsed = !getCollapsedSnapshot();
    writeCollapsed(sessionCollapsed);
  }, []);

  // Số dư tải lại mỗi lần đổi trang (giống trước: chip nằm trong trang nên tải theo trang)
  useEffect(() => {
    let cancelled = false;
    fetchBalance()
      .then((next) => {
        if (!cancelled) setBalance(next);
      })
      .catch(() => undefined); // chip giữ số cũ / ẩn; trang billing tự báo lỗi của nó
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Drawer mobile là lớp phủ modal: focus vào trong + giữ Tab, đóng thì trả focus về nút Mở menu; Esc đóng
  useDialogFocus(drawerRef, navOpen);
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  const value = useMemo(
    () => ({ navOpen, openNav, closeNav, collapsed, toggleCollapsed, balance }),
    [navOpen, openNav, closeNav, collapsed, toggleCollapsed, balance]
  );

  return (
    <AppShellContext.Provider value={value}>
      <div className="flex h-dvh overflow-hidden bg-surface-container-lowest">
        {navOpen && (
          <div aria-hidden className="fixed inset-0 z-40 bg-inverse-surface/40 md:hidden" onClick={closeNav} />
        )}
        <div
          ref={drawerRef}
          role={navOpen ? "dialog" : undefined}
          aria-modal={navOpen || undefined}
          aria-label={navOpen ? t("menu") : undefined}
          // Đóng trên mobile ⇒ `invisible` để link trong drawer ra khỏi thứ tự Tab; desktop luôn hiện.
          // Chỉ transition `visibility` khi đóng (giữ hiện lúc trượt ra); khi mở phải hiện ngay để focus vào được.
          // Desktop: `relative z-40` để tooltip của sidebar thu gọn nổi trên vùng nội dung (kể cả thanh sticky z-30 của trang), dưới modal (z-50)
          className={`fixed inset-y-0 left-0 z-50 duration-200 md:relative md:z-40 md:translate-x-0 md:visible ${
            navOpen ? "translate-x-0 visible transition-transform" : "-translate-x-full invisible transition-[transform,visibility]"
          }`}
        >
          {sidebar}
        </div>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </AppShellContext.Provider>
  );
}

export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell phải nằm trong <AppShell>");
  return ctx;
}
