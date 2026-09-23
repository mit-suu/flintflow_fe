"use client";

import CountBadge from "@/components/ui/CountBadge";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";

/** Panel bên phải — mỗi lúc chỉ mở một. */
export type WorkspacePanel = "change" | "verification" | "tools";

interface WorkspaceToolRailProps {
  active: WorkspacePanel | null;
  onToggle: (panel: WorkspacePanel) => void;
  /** Số cờ đỏ đang mở — hiện trên nút Verification. */
  flagsCount?: number;
  /** Mode 1 v2: panel công cụ chứa kế hoạch step & version. */
  mode1?: boolean;
  /** Có ⇒ đang mở rộng trang: nút thoát nằm đầu rail (luôn thấy, không đè panel). */
  onExitFocus?: () => void;
}

interface RailItem {
  id: WorkspacePanel;
  icon: IconName;
  label: string;
}

/**
 * Thanh icon dọc sát cạnh phải workspace: mở/đóng panel Sửa có xem trước, Verification, Công cụ.
 * Nhãn hiện ở tooltip (hover/focus) và là tên của nút cho trình đọc màn hình.
 */
export default function WorkspaceToolRail({ active, onToggle, flagsCount = 0, mode1 = false, onExitFocus }: WorkspaceToolRailProps) {
  const items: RailItem[] = [
    { id: "change", icon: "pencil", label: "Sửa tài liệu có xem trước diff" },
    { id: "verification", icon: "shield-check", label: "Verification & độ sẵn sàng" },
    { id: "tools", icon: "toolbox", label: mode1 ? "Cờ, change request & version" : "Công cụ: thuật ngữ, hàng đợi màn" },
  ];

  return (
    <nav aria-label="Công cụ workspace" className="w-12 shrink-0 bg-surface-container-lowest flex flex-col items-center gap-1 py-2">
      {onExitFocus && (
        <>
          <IconButton icon="collapse" label="Thoát mở rộng (Esc)" onClick={onExitFocus} />
          <div aria-hidden className="w-6 h-px bg-outline-variant my-1" />
        </>
      )}
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={isActive}
            aria-label={item.label}
            className={`group/rail relative w-9 h-9 flex items-center justify-center rounded-control transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive ? "bg-primary-fixed text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <Icon name={item.icon} size={18} weight={isActive ? "fill" : "regular"} />
            {item.id === "verification" && flagsCount > 0 && (
              <CountBadge count={flagsCount} tone="alert" className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 text-[9.5px]" />
            )}
            <span
              aria-hidden
              className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-50 whitespace-nowrap rounded-inner bg-inverse-surface px-2.5 py-1 text-[12px] font-medium text-inverse-on-surface opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100"
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
