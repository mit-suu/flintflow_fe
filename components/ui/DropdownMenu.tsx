"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

export interface DropdownMenuItem {
  label: string;
  icon?: IconName;
  tone?: "default" | "danger";
  onSelect: () => void;
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
  /** `bottom-end`: dưới, canh phải (menu ⋮ của card); `top`: mở lên trên, canh trái trigger (menu user ở đáy sidebar). */
  placement?: "bottom-end" | "top";
  className?: string;
}

/** Menu thả xuống dùng chung: đóng khi bấm ra ngoài hoặc Esc (trả focus về trigger), mũi tên lên/xuống giữa các mục. */
export default function DropdownMenu({ trigger, items, header, placement = "bottom-end", className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
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
          className={`absolute z-40 bg-surface-container-lowest border border-outline-variant rounded-[14px] shadow-[0_16px_42px_rgba(25,24,23,0.16)] p-1.5 flex flex-col gap-0.5 ${
            // `top`: rộng bằng trigger nhưng tối thiểu 232px (sidebar thu gọn chỉ ~48px)
            placement === "top" ? "bottom-[calc(100%+8px)] left-0 w-[max(100%,232px)]" : "right-0 top-[calc(100%+6px)] min-w-[168px]"
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[12.5px] font-semibold text-left w-full cursor-pointer transition-colors focus-visible:outline-none ${
                item.tone === "danger"
                  ? "text-error hover:bg-error-container focus-visible:bg-error-container"
                  : "text-on-surface-dark hover:bg-surface-container-low focus-visible:bg-surface-container-low"
              }`}
            >
              {item.icon && <Icon name={item.icon} size={15} />}
              <span className="flex-1">{item.label}</span>
              {item.trailing}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
