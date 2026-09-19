"use client";

import Link from "next/link";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";

/*
 * Primitive dùng chung của các trang xác thực — cùng ngôn ngữ với landing / dashboard: phẳng, không viền,
 * phân biệt bằng nền; input nền xám ấm, chỉ có focus ring; nút `primary` nền trơn bo `rounded-control`.
 */

/** Card trắng chứa form — bóng mềm như card sidebar của dashboard. */
export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex w-full flex-col gap-5 rounded-dialog bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgba(25,24,23,0.04),0_12px_32px_rgba(25,24,23,0.07)] sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

/** Tiêu đề trang: nhãn nhỏ (tuỳ chọn) + h1 + mô tả. */
export function AuthHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div>
      {eyebrow && <p className="mb-1.5 text-[12px] font-bold text-primary">{eyebrow}</p>}
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-on-surface">{title}</h1>
      {children && <div className="mt-2 text-[14px] leading-relaxed text-on-surface-variant">{children}</div>}
    </div>
  );
}

/** Ô vuông icon trạng thái ở đầu card (gửi mã, thành công, thiếu dữ liệu). */
export function StatusIcon({ icon, tone }: { icon: IconName; tone: "primary" | "success" | "error" }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    error: "bg-error-container text-error",
  }[tone];
  return (
    <span className={`grid size-12 place-items-center rounded-card ${toneClass}`}>
      <Icon name={icon} size={24} />
    </span>
  );
}

const inputBase =
  "h-12 w-full rounded-control px-4 text-[14px] text-on-surface outline-none transition-[background-color,box-shadow] placeholder:text-on-surface-subtle focus:ring-2";

/** Class ô nhập: nền xám ấm, focus nền trắng + ring tím; lỗi ⇒ nền đỏ nhạt + ring đỏ. */
export function inputClass(invalid = false) {
  return `${inputBase} ${
    invalid
      ? "bg-error-container focus:bg-error-container focus:ring-error/60"
      : "bg-surface-container hover:bg-surface-container-high focus:bg-surface-container-lowest focus:ring-primary"
  }`;
}

/** Nhãn ô nhập. */
export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[12.5px] font-bold text-on-surface-medium">
      {children}
    </label>
  );
}

/** Ô nhập có nhãn phía trên. */
export function TextField({ id, label, ...input }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input id={id} {...input} className={inputClass()} />
    </div>
  );
}

/** Dòng lỗi dưới ô nhập. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-[12px] font-semibold text-error">
      <Icon name="error-circle" size={14} />
      {children}
    </p>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Có ⇒ nền đỏ + dòng lỗi bên dưới. */
  error?: string | null;
  /** Tên dùng trong nhãn nút mắt ("Hiện <toggleName>"); mặc định là `label` viết thường. */
  toggleName?: string;
  /** Ẩn nhãn phía trên (vẫn có `aria-label`) — form đăng nhập gọn. */
  hideLabel?: boolean;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
  /** Hiện dưới ô (vd. thanh độ mạnh). */
  children?: ReactNode;
}

/** Ô mật khẩu có nút mắt hiện / ẩn. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  toggleName,
  hideLabel = false,
  placeholder = "••••••••",
  autoComplete,
  autoFocus,
  minLength,
  children,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const name = toggleName ?? label.toLowerCase();

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-label={hideLabel ? label : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass(Boolean(error))} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ẩn ${name}` : `Hiện ${name}`}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-inner text-on-surface-muted transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={visible ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {children}
    </div>
  );
}

/** Độ mạnh mật khẩu — một nguồn cho đăng ký và đặt lại mật khẩu. */
export function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; text: string } {
  if (!pwd) return { level: 0, text: "" };
  if (pwd.length < 6) return { level: 1, text: "Yếu" };
  if (pwd.length < 8 || !/\d/.test(pwd)) return { level: 2, text: "Trung bình" };
  return { level: 3, text: "Mạnh" };
}

const STRENGTH_TONE = {
  1: { bar: "bg-error", text: "text-error" },
  2: { bar: "bg-accent-gold", text: "text-accent-gold-text" },
  3: { bar: "bg-success-dark", text: "text-success" },
} as const;

/** Thanh 3 đoạn báo độ mạnh; không hiện khi ô còn trống. */
export function StrengthMeter({ password }: { password: string }) {
  const { level, text } = getPasswordStrength(password);
  if (level === 0) return null;
  const tone = STRENGTH_TONE[level];
  return (
    <div className="flex items-center gap-2.5 pt-0.5">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= level ? tone.bar : "bg-surface-container-highest"}`} />
        ))}
      </div>
      <span className={`text-[11.5px] font-bold ${tone.text}`}>{text}</span>
    </div>
  );
}

/** Nút chính: nền `primary` trơn; đang chạy ⇒ spinner + nhãn chờ, khoá nút. */
export function SubmitButton({
  loading = false,
  loadingLabel,
  children,
  type = "submit",
  disabled,
  onClick,
}: {
  loading?: boolean;
  loadingLabel: string;
  children: ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <>
          <span aria-hidden="true" className="ff-spinner size-3.5 shrink-0 rounded-full border-2 border-white/40 border-t-white" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Link nhìn như nút chính (điều hướng sang trang khác). */
export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-12 w-full items-center justify-center rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

const ALERT_TONE = {
  error: { box: "bg-error-container text-on-error-container", icon: "error-circle" },
  success: { box: "bg-success-soft text-success", icon: "check" },
  warning: { box: "bg-accent-gold-soft text-accent-gold-text", icon: "warning" },
} as const satisfies Record<string, { box: string; icon: IconName }>;

/** Thông báo phẳng (lỗi / thành công / cảnh báo). */
export function AuthAlert({ tone, children }: { tone: keyof typeof ALERT_TONE; children: ReactNode }) {
  const style = ALERT_TONE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-control px-3.5 py-3 text-[13px] leading-relaxed ${style.box}`}>
      <Icon name={style.icon} size={17} className="mt-px" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Vạch ngăn có chữ ở giữa ("hoặc"). */
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-on-surface-subtle">
      <span className="h-px flex-1 bg-surface-container-highest" />
      {children}
      <span className="h-px flex-1 bg-surface-container-highest" />
    </div>
  );
}

/** Link phụ quay về một trang (mặc định trang đăng nhập). */
export function BackLink({ href = "/login", children = "← Quay lại đăng nhập" }: { href?: string; children?: ReactNode }) {
  return (
    <div className="text-center">
      <Link href={href} className="text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-on-surface">
        {children}
      </Link>
    </div>
  );
}

/** Link chữ tím trong câu ("Đăng ký miễn phí", "Quên mật khẩu?"). */
export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-bold text-primary hover:text-primary-hover hover:underline">
      {children}
    </Link>
  );
}
