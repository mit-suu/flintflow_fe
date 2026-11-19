"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/lib/hooks/use-presence";

export interface PopoverTriggerProps {
  open: boolean;
  toggle: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
}

interface AnchoredPopoverProps {
  /** Nút mở: nhận trạng thái + hàm bật/tắt, tự gắn aria. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** Nội dung popup; `close` để đóng sau một hành động (vd bấm link). */
  children: (close: () => void) => ReactNode;
  label: string;
  /** Mép neo: popup mọc từ mép trái hay mép phải của nút (tự dịch vào trong nếu tràn màn hình). */
  align?: "left" | "right";
  widthClassName?: string;
  /**
   * Đang có việc chạy dở (vd tải tài liệu, chờ thẻ xác nhận credit trong chat) ⇒ bấm ra ngoài không đóng popup, để người
   * dùng còn thấy kết quả. Esc vẫn đóng.
   */
  keepOpen?: boolean;
}

/** Khoảng chừa với mép cửa sổ. */
const GUTTER = 16;

/**
 * Popup neo dưới một nút (cùng kiểu với lịch sử phiên chat): đóng khi bấm ra ngoài hoặc Esc, mờ dần khi mở / đóng.
 * Vẽ qua portal với `position: fixed` — pane chat / tài liệu có `overflow-hidden` nên popup đặt tuyệt đối trong pane sẽ bị
 * cắt khi pane hẹp. Dùng cho danh sách tài liệu ở đầu khung chat và danh sách version ở đầu tài liệu.
 */
export default function AnchoredPopover({ trigger, children, label, align = "left", widthClassName = "w-[360px]", keepOpen = false }: AnchoredPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Phần tử neo giữ ở state (callback ref): hàm `close` truyền cho nội dung lúc render không được đọc ref
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const keepOpenRef = useRef(keepOpen);
  const { mounted, shown } = usePresence(open, 150);

  useEffect(() => {
    keepOpenRef.current = keepOpen;
  }, [keepOpen]);

  /** Đặt popup dưới nút, canh theo `align`, kẹp trong cửa sổ. */
  const place = useCallback(() => {
    const anchor = root?.getBoundingClientRect();
    const width = popupRef.current?.offsetWidth ?? 0;
    if (!anchor) return;
    const wanted = align === "left" ? anchor.left : anchor.right - width;
    const left = Math.max(GUTTER, Math.min(wanted, window.innerWidth - GUTTER - width));
    setPos({ top: anchor.bottom + 6, left });
  }, [align, root]);

  useLayoutEffect(() => {
    if (!mounted) return;
    place();
    window.addEventListener("resize", place);
    // Cuộn ở bất kỳ vùng nào (capture) cũng có thể dời nút
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [mounted, place]);

  const close = useCallback(() => {
    setOpen(false);
    // Trả focus về nút mở để bàn phím không lạc
    root?.querySelector<HTMLElement>("button")?.focus();
  }, [root]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (root?.contains(target) || popupRef.current?.contains(target) || keepOpenRef.current) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, root]);

  return (
    <div ref={setRoot} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), "aria-expanded": open, "aria-haspopup": "dialog" })}
      {mounted &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label={label}
            aria-hidden={!open || undefined}
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? undefined : "hidden" }}
            className={`fixed z-50 ${widthClassName} max-w-[calc(100vw-32px)] max-h-[min(480px,calc(100vh-96px))] overflow-y-auto ff-scroll bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-3 ${
              align === "left" ? "origin-top-left" : "origin-top-right"
            } transition-[opacity,transform] ease-out motion-reduce:transition-none ${
              shown ? "opacity-100 scale-100 translate-y-0 duration-200" : "opacity-0 scale-95 -translate-y-1 duration-150 pointer-events-none"
            }`}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </div>
  );
}
