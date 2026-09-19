import type { ButtonHTMLAttributes } from "react";
import Icon, { type IconName } from "./Icon";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  icon: IconName;
  /** Bắt buộc: nút chỉ có icon phải có tên cho trình đọc màn hình. */
  label: string;
  /** `pill`: nút bầu dục nhỏ (menu ⋮ trên card). */
  size?: "pill" | "sm" | "md";
}

const SIZE = { pill: "w-9 h-6", sm: "w-7 h-7", md: "w-9 h-9" } as const;

/** Nút tròn chỉ có icon (menu ⋮, thu gọn sidebar, đóng dialog). */
export default function IconButton({ icon, label, size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${SIZE[size]} ${className ?? ""}`}
      {...rest}
    >
      <Icon name={icon} size={size === "md" ? 18 : size === "sm" ? 15 : 14} />
    </button>
  );
}
