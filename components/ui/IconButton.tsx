import type { ButtonHTMLAttributes } from "react";
import Icon, { type IconName } from "./Icon";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  icon: IconName;
  /** Bắt buộc: nút chỉ có icon phải có tên cho trình đọc màn hình. */
  label: string;
  size?: "sm" | "md";
}

/** Nút tròn chỉ có icon (menu ⋮, thu gọn sidebar, đóng dialog). */
export default function IconButton({ icon, label, size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${size === "sm" ? "w-7 h-7" : "w-9 h-9"} ${className ?? ""}`}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 15 : 18} />
    </button>
  );
}
