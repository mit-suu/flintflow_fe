"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

/** Mốc `lg` của Tailwind: từ đây panel comment là cột phải, dưới đây là sheet trượt từ đáy. */
const DESKTOP_QUERY = "(min-width: 1024px)";
const TRIGGER_ID = "view-comments-open";

const subscribe = (onChange: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
// Không có `matchMedia` (SSR, jsdom) ⇒ coi như desktop: panel luôn hiện, không khoá bằng `inert`
const isDesktopNow = () => (typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia(DESKTOP_QUERY).matches);

export const useIsDesktop = (): boolean => useSyncExternalStore(subscribe, isDesktopNow, () => true);

const noopSubscribe = () => () => {};
/**
 * `false` lúc server render và lúc hydrate, `true` sau đó. Bề rộng cột đọc từ localStorage khác giá trị server dựng; React
 * không vá attribute lệch khi hydrate nên chỉ gắn `style` sau bước này.
 */
const useHydrated = (): boolean => useSyncExternalStore(noopSubscribe, () => true, () => false);

interface CommentSheetProps {
  /** Kết quả `useIsDesktop()` của trang (trang cần nó để khoá phần còn lại khi sheet mở). */
  isDesktop: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Số comment đang mở — nhãn của nút nổi. */
  openCount: number;
  /** Bề rộng cột trên desktop (px, kéo được bằng thanh đổi cỡ); dưới 1024px sheet luôn phủ hết chiều ngang. */
  desktopWidth: number;
  /** Trần bề rộng theo khung chứa (CSS, vd `calc(100% - 484px)`). */
  desktopMaxWidth?: string;
  children: ReactNode;
}

/** `id` của cột comment trên desktop: thanh đổi cỡ đo bề rộng từ mép phải của nó. */
export const COMMENT_COLUMN_ID = "view-comments-column";

/**
 * Vỏ của panel comment trang đọc. Desktop: cột phải dính dưới header, cao bằng phần màn hình còn lại, tự cuộn bên trong.
 * Dưới 1024px: bottom sheet 85% chiều cao + nền mờ (bấm nền / `Esc` để đóng), mở bằng nút nổi "Comment (n)" hoặc bằng nút
 * ghim / số comment trong tài liệu. Trang khoá phần còn lại (`inert`) khi sheet mở nên Tab không lọt ra ngoài.
 *
 * Panel chỉ render **một lần** (không nhân đôi cho hai cỡ màn): sheet đóng thì trượt khỏi màn và `inert` để không
 * nhận focus / không bị trình đọc màn hình đọc.
 */
export default function CommentSheet({ isDesktop, open, onOpenChange, openCount, desktopWidth, desktopMaxWidth, children }: CommentSheetProps) {
  const t = useTranslations("workspace.view");
  const hydrated = useHydrated();
  const sheet = !isDesktop;
  const showing = isDesktop || open;
  const sheetRef = useRef<HTMLDivElement>(null);
  /** Nơi focus đứng trước khi sheet mở (nút nổi, nút ghim…) — đóng thì trả về đó. */
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sheet || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet, open, onOpenChange]);

  useEffect(() => {
    if (!sheet) return;
    if (open) {
      if (!returnTo.current) returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // Ô soạn tự focus (autoFocus) thì giữ; không thì đưa focus vào sheet để trình đọc màn hình bắt đầu từ đây
      const node = sheetRef.current;
      if (node && !node.contains(document.activeElement)) node.focus();
      return;
    }
    const back = returnTo.current;
    returnTo.current = null;
    if (back) (back.isConnected ? back : document.getElementById(TRIGGER_ID))?.focus();
  }, [sheet, open]);

  return (
    <>
      {sheet && open && <div aria-hidden className="fixed inset-0 z-40 bg-inverse-surface/40 lg:hidden" onClick={() => onOpenChange(false)} />}
      <div
        ref={sheetRef}
        id={COMMENT_COLUMN_ID}
        tabIndex={-1}
        // `maxWidth` giữ chỗ tối thiểu cho tài liệu khi cửa sổ thu hẹp sau lúc đã kéo cột rộng
        style={isDesktop && hydrated ? { width: desktopWidth, maxWidth: desktopMaxWidth } : undefined}
        inert={!showing}
        {...(sheet && open ? { role: "dialog", "aria-modal": true, "aria-label": t("commentsSheet") } : {})}
        className={`fixed inset-x-0 bottom-0 z-50 h-[85dvh] rounded-t-dialog overflow-hidden outline-none transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-y-0" : "translate-y-full"
        } lg:z-auto lg:inset-x-auto lg:bottom-auto lg:translate-y-0 lg:transition-none lg:sticky lg:top-20 lg:shrink-0 lg:w-[400px]lg:h-[calc(100dvh-6rem)] lg:rounded-card`}
      >
        {children}
      </div>
      {sheet && !open && (
        <Button
          id={TRIGGER_ID}
          icon="feedback"
          onClick={() => onOpenChange(true)}
          className="fixed z-30 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden h-12! rounded-full! px-5!"
        >
          {t("openComments", { count: openCount })}
        </Button>
      )}
    </>
  );
}
