"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Nút lọc "Trạng thái: Đang làm ▾" mở một danh sách tự dựng (cùng kiểu menu ⋮ của app) thay cho `<select>` gốc —
 * danh sách gốc là giao diện của hệ điều hành (nền xanh, viền vuông), CSS không chỉnh được.
 *
 * Theo mẫu ARIA "select-only combobox": nút giữ focus (`role="combobox"`), mục đang trỏ báo qua
 * `aria-activedescendant`. Bàn phím: ↑/↓ di chuyển (đóng thì mở), Enter/Space chọn, Esc đóng, Home/End về đầu/cuối.
 */
export default function FilterSelect<T extends string>({ label, value, options, onChange, className }: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const current = options[selectedIndex]?.label ?? "";

  // Đóng khi bấm ra ngoài
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    const moves: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(i + 1, last)),
      ArrowUp: () => setActive((i) => Math.max(i - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => setOpen(false),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      move();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // Phẳng không viền: nền xám ấm, hover/đang mở đậm một nấc
        className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control text-[12.5px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          open ? "bg-surface-container-high" : "bg-surface-container hover:bg-surface-container-high"
        }`}
      >
        <span className="text-on-surface-muted font-medium">{label}:</span>
        <span className="text-on-surface font-semibold">{current}</span>
        <Icon
          name="chevron-down"
          size={13}
          className={`text-on-surface-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          // Bộ lọc nằm bên phải thanh công cụ ⇒ canh phải; rộng tối thiểu bằng nút
          className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[max(100%,176px)] bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-1.5 flex flex-col gap-0.5"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(index)}
                // mousedown để chọn trước khi nút mất focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(index);
                }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-inner text-[12.5px] cursor-pointer transition-colors ${
                  index === active ? "bg-surface-container" : ""
                } ${selected ? "text-primary font-semibold" : "text-on-surface-dark font-medium"}`}
              >
                <span className="flex-1 whitespace-nowrap">{option.label}</span>
                {selected && <Icon name="check" size={14} weight="bold" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
