"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

export interface DropdownMenuItem {
  label: string;
  icon?: IconName;
  tone?: "default" | "danger";
  onSelect: () => void;
  /** Mục mờ, không chọn được (vd. đã hết lượt). */
  disabled?: boolean;
  /** Phần bên phải dòng (vd. nhãn gói trong menu user). */
  trailing?: ReactNode;
}

export interface DropdownTriggerProps {
  onClick: (e: React.MouseEvent) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
}

interface DropdownMenuProps {
  /** Nhận props phải trải lên nút mở menu (toggle + aria). */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  items: readonly DropdownMenuItem[];
  /** Nội dung đầu menu, vd. thông tin user. */
  header?: ReactNode;
  /**
   * `bottom-end`: dưới, canh phải (menu ⋮ của card); `top`: mở lên trên, canh trái trigger (menu user ở đáy
   * sidebar); `right-start`: bay ra bên phải trigger bằng `position: fixed` — dùng khi trigger nằm trong một
   * vùng cuộn (`overflow-y-auto` cắt luôn cả chiều ngang, menu đặt tuyệt đối sẽ bị xén).
   */
  placement?: "bottom-end" | "top" | "right-start";
  className?: string;
}

/** Bề ngang menu `right-start` — cần một số cụ thể để tính xem bên phải còn đủ chỗ không. */
const MENU_WIDTH = 232;

/** Menu thả xuống dùng chung: đóng khi bấm ra ngoài hoặc Esc (trả focus về trigger), mũi tên lên/xuống giữa các mục. */
export default function DropdownMenu({ trigger, items, header, placement = "bottom-end", className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  /** Toạ độ màn hình của menu `right-start`; `null` khi chưa đo hoặc dùng placement khác. */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || placement !== "right-start") return;
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Không đủ chỗ bên phải (màn hẹp) thì nhả sang trái trigger thay vì tràn khỏi khung nhìn.
      const fitsRight = rect.right + 8 + MENU_WIDTH <= window.innerWidth;
      setAnchor({ top: rect.top, left: fitsRight ? rect.right + 8 : Math.max(8, rect.left - 8 - MENU_WIDTH) });
    };
    measure();
    // Trigger nằm trong vùng cuộn ⇒ cuộn là toạ độ cũ sai ngay; `capture` để bắt cả cuộn của vùng bên trong.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>("[aria-haspopup='menu']")?.focus();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)") ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next = (index + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      {trigger({
        onClick: (e) => {
          // Trigger thường nằm trong card có Link: không cho click lan ra điều hướng
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={moveFocus}
          style={
            placement === "right-start" ? { top: anchor?.top ?? 0, left: anchor?.left ?? 0, width: MENU_WIDTH } : undefined
          }
          className={`z-50 bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-1.5 flex flex-col gap-0.5 ${
            placement === "right-start"
              ? // Chưa đo xong thì chưa vẽ, tránh một frame nhảy từ góc trên bên trái màn hình
                `fixed ${anchor ? "" : "invisible"}`
              : // `top`: rộng bằng trigger nhưng tối thiểu 232px (sidebar thu gọn chỉ ~48px)
                `absolute ${
                  placement === "top"
                    ? "bottom-[calc(100%+8px)] left-0 w-[max(100%,232px)]"
                    : "right-0 top-[calc(100%+6px)] min-w-[168px]"
                }`
          }`}
        >
          {header && (
            <>
              <div className="px-2 pt-1.5 pb-2">{header}</div>
              <div className="h-px bg-outline-subtle mx-1.5 mb-1" />
            </>
          )}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-inner text-body font-semibold text-left w-full cursor-pointer transition-colors focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                item.tone === "danger"
                  ? "text-error hover:bg-error-container focus-visible:bg-error-container"
                  : "text-on-surface-dark hover:bg-surface-container focus-visible:bg-surface-container"
              }`}
            >
              {item.icon && <Icon name={item.icon} size={15} />}
              {/* Nhãn dài (tên tổ chức) phải tự cắt, nếu không nó đẩy phần bên phải ra khỏi menu */}
              <span className="flex-1 truncate">{item.label}</span>
              {item.trailing && <span className="shrink-0">{item.trailing}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
