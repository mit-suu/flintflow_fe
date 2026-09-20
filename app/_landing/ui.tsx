import * as motion from "motion/react-client";
import Link from "next/link";
import type { ReactNode } from "react";
import { PHASES } from "@/lib/constants/step-registry";
import type { GroupTone } from "./content";
import { fadeUp, growX, inView, stagger } from "./motion";

/*
 * Primitive dùng chung của landing — cùng ngôn ngữ với dashboard: phẳng, không viền, phân biệt bằng nền,
 * bo góc theo thang `rounded-control|card|dialog`, nút nền trơn `primary`.
 */

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const buttonVariants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high",
  /** Nút trắng trên khối màu `primary`. */
  inverse: "bg-surface-container-lowest text-primary-hover hover:bg-primary-soft",
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
  const cls = `inline-flex h-12 items-center justify-center gap-2 rounded-control px-6 text-[14.5px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] ${focusRing} ${buttonVariants[variant]} ${className}`;
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

export function ArrowRight({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Hạt kim cương vàng — lấy từ ô vuông cam trong logo, dùng làm dấu nhấn. */
export function Diamond({ className = "size-2" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rotate-45 rounded-[2px] bg-accent-gold ${className}`} />;
}

/** Nhãn nhỏ đầu section: hạt kim cương + chữ. */
export function Eyebrow({ children, className = "text-on-surface-variant" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2.5 text-[13px] font-bold ${className}`}>
      <Diamond />
      {children}
    </p>
  );
}

/** Màu thẻ thư mục theo tone — thân / lưng + tab, cùng bộ token `folder-*` và `surface-card` của dashboard. */
export const TONE_FILL: Record<GroupTone, { body: string; back: string; tab: string }> = {
  blue: { body: "bg-folder-blue", back: "bg-folder-blue-back", tab: "text-folder-blue-back" },
  amber: { body: "bg-folder-amber", back: "bg-folder-amber-back", tab: "text-folder-amber-back" },
  green: { body: "bg-folder-green", back: "bg-folder-green-back", tab: "text-folder-green-back" },
  purple: { body: "bg-surface-card", back: "bg-card-track", tab: "text-card-track" },
};

/**
 * Hình thư mục như `FolderCard` của dashboard: tấm lưng + tab dốc chữ S phía sau, thân màu nhạt hơn phía trước.
 * Chỉ là khung trình bày (không kéo thả, không menu).
 */
export function FolderShape({
  tone,
  className = "",
  bodyClassName = "",
  children,
}: {
  tone: GroupTone;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const fill = TONE_FILL[tone];
  return (
    <div className={`relative pt-[22px] ${className}`}>
      <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 top-[14px] rounded-card rounded-tl-none ${fill.back}`} />
      <svg aria-hidden="true" viewBox="0 0 128 24" className={`absolute left-0 top-0 h-[24px] w-[128px] ${fill.tab}`} fill="currentColor">
        <path d="M0 24V16Q0 0 16 0H84C96 0 100 5 105 9.5C110 14 114 14 128 14V24Z" />
      </svg>
      <div className={`relative h-full rounded-card ${fill.body} ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/**
 * Thanh tiến độ liền theo 12 giai đoạn như card dự án: phần đã qua tô `primary`, giai đoạn đang làm tô nhạt.
 * Chạy từ trái sang khi phần tử cha (motion) chuyển sang trạng thái `show`.
 */
export function PhaseBar({ done }: { done: number }) {
  const width = (n: number) => `${(Math.min(n, PHASES.length) / PHASES.length) * 100}%`;
  return (
    <div aria-hidden="true" className="relative h-2 overflow-hidden rounded-full bg-card-track">
      <motion.span variants={growX} className="absolute inset-y-0 left-0 rounded-full bg-primary/35" style={{ width: width(done + 1), originX: 0 }} />
      <motion.span variants={growX} className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: width(done), originX: 0 }} />
    </div>
  );
}

const TEXTURES = { dots: "landing-dots", "dots-light": "landing-dots-light" } as const;

/**
 * Lớp hoạ tiết phẳng phủ kín phần tử cha (cha phải `relative`): lưới chấm tối hoặc sáng (`globals.css`).
 * `mask` quyết định vùng hoạ tiết mờ dần.
 */
export function Texture({ kind, mask, className = "" }: { kind: keyof typeof TEXTURES; mask?: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${TEXTURES[kind]} ${className}`}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    />
  );
}

/** Dải 12 đoạn màu theo bốn bước BA — "vạch giai đoạn" làm đường phân cách section; cuộn tới thì chạy lần lượt từng đoạn. */
export function PhaseRibbon({ groups, className = "" }: { groups: readonly { tone: GroupTone; phases: readonly string[] }[]; className?: string }) {
  return (
    <motion.div aria-hidden="true" {...inView} variants={stagger(0.045)} className={`flex gap-1 ${className}`}>
      {groups.flatMap((group) =>
        group.phases.map((phase) => (
          <motion.span
            key={phase}
            variants={growX}
            style={{ originX: 0 }}
            className={`h-full flex-1 rounded-full ${TONE_FILL[group.tone].back}`}
          />
        ))
      )}
    </motion.div>
  );
}

/** Tiêu đề section: eyebrow + h2 + mô tả ngắn; hiện dần khi cuộn tới. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subline,
  align = "left",
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  subline?: string;
  align?: "left" | "center";
}) {
  const center = align === "center";
  return (
    <motion.div {...inView} variants={fadeUp} className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 text-balance text-3xl font-bold tracking-[-0.025em] text-on-surface sm:text-[42px] sm:leading-[1.1]">
        {title}
      </h2>
      {subline && <p className="mt-4 text-pretty text-base leading-relaxed text-on-surface-variant sm:text-[17px]">{subline}</p>}
    </motion.div>
  );
}
