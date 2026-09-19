import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* Primitive dùng chung của landing (bản sáng, mock L1) — một nguồn cho nút, lưới nền, khối blob trang trí. */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF0] focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const buttonVariants = {
  /** Nút gradient tím có chấm tròn chứa mũi tên ở cuối. */
  primary: `landing-gradient inline-flex items-center justify-center gap-3 rounded-full py-2 pl-6 pr-2 text-[15px] font-bold text-white shadow-[0_16px_40px_rgba(139,92,240,0.4)] transition-transform hover:-translate-y-0.5 ${focusRing}`,
  /** Nút gradient gọn (header, card giá) — không có chấm mũi tên. */
  solid: `landing-gradient inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_26px_rgba(139,92,240,0.35)] transition-transform hover:-translate-y-0.5 ${focusRing}`,
  secondary: `inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-outline bg-white px-6 py-3.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low ${focusRing}`,
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const cls = `${buttonVariants[variant]} ${className}`;
  // Anchor nội trang dùng <a> để cuộn mượt; route dùng <Link>.
  return href.startsWith("#") ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Chấm tròn trắng mờ chứa mũi tên, đặt cuối nút `primary`. */
export function ArrowDot({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-white/25 ${className}`} aria-hidden="true">
      <ArrowRight />
    </span>
  );
}

export function ArrowRight({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lớp lưới 1px phủ kín section cha (cha phải `relative`); `mask` quyết định vùng lưới mờ dần. */
export function GridBackdrop({ mask, className = "" }: { mask: string; className?: string }) {
  const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };
  return <div aria-hidden="true" className={`landing-grid-bg pointer-events-none absolute inset-0 ${className}`} style={style} />;
}

/** Khối "blob" tím trang trí — thuần hình ảnh, ẩn với trình đọc màn hình. */
export function Blob({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <div
        className="absolute inset-0 opacity-85 blur-[3px]"
        style={{
          borderRadius: "58% 42% 55% 45% / 45% 58% 42% 55%",
          background:
            "radial-gradient(circle at 30% 25%, #F0E8FF 0%, #D9C4FA 22%, #B98BF5 45%, #8B5CF0 68%, #C7B8F5 88%, transparent 96%)",
        }}
      />
      <div
        className="absolute inset-[10%] blur-[8px]"
        style={{
          borderRadius: "52% 48% 60% 40% / 48% 52% 48% 52%",
          background: "radial-gradient(circle at 65% 30%, rgba(255,255,255,0.95), rgba(255,214,245,0.5) 35%, transparent 62%)",
        }}
      />
      <div
        className="absolute bottom-[16%] right-[12%] h-[28%] w-[38%] rounded-full blur-[14px]"
        style={{ background: "radial-gradient(circle, rgba(242,197,114,0.55), transparent 70%)" }}
      />
      <div
        className="absolute inset-[-16%] rounded-full blur-[38px]"
        style={{ background: "radial-gradient(circle, rgba(139,92,240,0.18), transparent 70%)" }}
      />
    </div>
  );
}
