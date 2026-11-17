"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  /**
   * Mép neo danh sách. `end` (mặc định) nở sang trái — đúng cho bộ lọc đứng cuối thanh công cụ rộng.
   * Dùng `start` khi nút nằm **sát mép trái** của một khung hẹp: menu rộng tối thiểu 176px, nở sang trái
   * là tràn ra ngoài khung, mà khung cuộn (`overflow-y-auto`) theo CSS có trục ngang là `auto` chứ không
   * `visible` nên nó cắt mất phần tràn — người dùng thấy cụt đầu chữ.
   */
  align?: "start" | "end";
  /**
   * `inline` (mặc định): "Nhãn: Giá trị ▾" - bộ lọc trên thanh công cụ.
   * `value`: chỉ hiện giá trị, nhãn chỉ để đọc màn hình - ô chọn nằm trong ngữ cảnh đã rõ (vai trò trên dòng thành viên)
   * hoặc đã có nhãn hiển thị riêng phía trên (ô trong form, dùng kèm `fullWidth`).
   */
  labelMode?: "inline" | "value";
  /** Nút giãn hết bề ngang, chữ trái mũi tên phải - ô chọn trong form. */
  fullWidth?: boolean;
  disabled?: boolean;
  /**
   * Vẽ danh sách ra `body` bằng `position: fixed`, tự lật lên khi bên dưới không đủ chỗ. Dùng khi nút nằm trong một
   * vùng cuộn (`overflow-y-auto`) - danh sách đặt tuyệt đối sẽ bị vùng đó cắt mất phần thò ra.
   */
  portal?: boolean;
  className?: string;
}

/** Cao tối đa của danh sách nổi; bên dưới nút thiếu chỗ cỡ này thì lật lên trên. */
const PORTAL_MAX_HEIGHT = 280;
const LIST_GAP = 6;

/**
 * Nút lọc "Trạng thái: Đang làm ▾" mở một danh sách tự dựng (cùng kiểu menu ⋮ của app) thay cho `<select>` gốc —
 * danh sách gốc là giao diện của hệ điều hành (nền xanh, viền vuông), CSS không chỉnh được.
 *
 * Theo mẫu ARIA "select-only combobox": nút giữ focus (`role="combobox"`), mục đang trỏ báo qua
 * `aria-activedescendant`. Bàn phím: ↑/↓ di chuyển (đóng thì mở), Enter/Space chọn, Esc đóng, Home/End về đầu/cuối.
 */
export default function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  align = "end",
  labelMode = "inline",
  fullWidth = false,
  disabled = false,
  portal = false,
  className,
}: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Toạ độ màn hình của danh sách khi `portal`; `null` khi chưa đo. */
  const [floatStyle, setFloatStyle] = useState<CSSProperties | null>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const current = options[selectedIndex]?.label ?? "";

  // Đóng khi bấm ra ngoài (danh sách trong portal không phải con của rootRef)
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Danh sách nổi: đo theo nút, đo lại khi cuộn (kể cả vùng cuộn bên trong) hay đổi cỡ cửa sổ
  useLayoutEffect(() => {
    if (!open || !portal) return;
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - LIST_GAP;
      const flipUp = below < PORTAL_MAX_HEIGHT && rect.top > below;
      setFloatStyle({
        minWidth: Math.max(rect.width, 176),
        maxHeight: Math.min(PORTAL_MAX_HEIGHT, (flipUp ? rect.top : below) - 8),
        ...(flipUp ? { bottom: window.innerHeight - rect.top + LIST_GAP } : { top: rect.bottom + LIST_GAP }),
        ...(align === "start" ? { left: rect.left } : { right: window.innerWidth - rect.right }),
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, portal, align]);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
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

  const renderList = (list: React.ReactNode) => (portal ? createPortal(list, document.body) : list);

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full" : ""} ${className ?? ""}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // Phẳng không viền: nền xám ấm, hover/đang mở đậm một nấc
        className={`${fullWidth ? "flex w-full justify-between h-10" : "inline-flex h-9"} items-center gap-1.5 px-3.5 rounded-control text-body cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "bg-surface-container-high" : "bg-surface-container enabled:hover:bg-surface-container-high"
        }`}
      >
        {labelMode === "inline" && <span className="text-on-surface-muted font-medium">{label}:</span>}
        <span className={`text-on-surface truncate ${labelMode === "inline" ? "font-semibold" : "font-medium"}`}>{current}</span>
        <Icon
          name="chevron-down"
          size={13}
          className={`shrink-0 text-on-surface-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && renderList(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          style={portal ? (floatStyle ?? undefined) : undefined}
          // Rộng tối thiểu bằng nút. Canh theo `align`: mặc định canh phải (bộ lọc ở cuối thanh công cụ),
          // canh trái khi nút đứng đầu — xem chú thích ở prop `align`.
          // Bản `portal`: toạ độ do `floatStyle` đặt, z trên Modal (z-50) vì ô chọn có thể nằm trong hộp thoại
          className={`${
            portal
              ? `fixed z-[60] overflow-y-auto ${floatStyle ? "" : "invisible"}`
              : `absolute ${align === "start" ? "left-0" : "right-0"} top-[calc(100%+6px)] z-40 min-w-[max(100%,176px)]`
          } bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-1.5 flex flex-col gap-0.5`}
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
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-inner text-body cursor-pointer transition-colors ${
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
