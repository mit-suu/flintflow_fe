import Link from "next/link";
import type { ReactNode } from "react";

/* Primitive dùng chung của landing — một nguồn cho card, nút, tiêu đề section. */

/** Card phẳng: nền trắng 2%, viền 1px trắng 8%, bo 8px. Không blur, không glow. */
export const cardClass = "rounded-lg border border-white/[0.08] bg-white/[0.02]";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

const buttonVariants = {
  primary: `${buttonBase} border border-white bg-[#FAFAFA] text-zinc-950 hover:bg-zinc-200`,
  secondary: `${buttonBase} border border-white/[0.12] bg-transparent text-zinc-200 hover:border-white/25 hover:bg-white/[0.04]`,
} as const;

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof buttonVariants;
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

export function buttonClass(variant: keyof typeof buttonVariants = "primary") {
  return buttonVariants[variant];
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-[#FAFAFA] sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-pretty text-base leading-relaxed text-zinc-400">{description}</p>}
    </div>
  );
}

export function ArrowRight({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
