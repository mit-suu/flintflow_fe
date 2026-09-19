import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Đang gửi: khoá nút, hiện spinner, giữ nguyên nhãn để bố cục không nhảy. */
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-gradient-primary text-on-primary",
  secondary: "bg-surface-container-lowest text-on-surface-medium border border-outline hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  danger: "bg-error text-on-error hover:brightness-90",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[12.5px] gap-1.5",
  md: "h-10 px-5 text-[13.5px] gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-full font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner shrink-0"
        />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
