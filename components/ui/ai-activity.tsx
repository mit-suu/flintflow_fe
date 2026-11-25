"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

/**
 * Bộ hiệu ứng chờ AI dùng chung (kiểu nhật ký của agent): chữ có vệt sáng quét, dòng việc có icon trạng thái,
 * đồng hồ m:ss, dòng chờ có chữ phụ đổi dần. Mọi dòng CHÍNH phải đến từ sự kiện thật; chữ phụ chỉ là câu chờ chung,
 * không có số %/bước. Phẳng, không viền; giảm chuyển động ⇒ không quét/xoay/trượt.
 */

/** Bước đổi chữ phụ khi một việc kéo dài. */
const HINT_INTERVAL_MS = 9_000;
/** Mỗi loại việc có đúng ngần này câu phụ (`aiActivity.hints.<kind>.1..N`). */
const HINT_COUNT = 3;

/** Đồng hồ 1 giây/nhịp; `active=false` ⇒ dừng. */
const useNow = (active: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
};

/** Nhịp chuyển động chung: vào nhanh rồi chậm dần (ease-out), ra nhanh hơn vào. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const ENTER = { duration: 0.22, ease: EASE_OUT };
const EXIT = { duration: 0.14, ease: "easeIn" as const };
/** Icon đổi trạng thái (spinner ⇒ dấu tích) bật nhẹ bằng lò xo. */
const ICON_SPRING = { type: "spring" as const, stiffness: 520, damping: 28 };

/** `m:ss` (không đệm số phút: 0:07, 12:03). */
export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Loại việc chờ ⇒ bộ câu phụ chung (`aiActivity.hints.<kind>`). */
export type AiWaitKind = "generic" | "chat" | "reference" | "document" | "check" | "diagram";

interface ShimmerTextProps {
  children: ReactNode;
  className?: string;
}

/** Chữ có ánh sáng chạy một chiều (~2s/lượt). */
export function ShimmerText({ children, className = "" }: ShimmerTextProps) {
  return <span className={`ff-ai-shimmer ${className}`.trim()}>{children}</span>;
}

/** Ba chấm nhảy lần lượt sau chữ của việc đang làm ("Soạn nội dung ···"). Giảm chuyển động ⇒ ba chấm đứng yên. */
export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`ff-dots ${className}`.trim()}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** Bỏ dấu "…" / "..." cuối nhãn — ba chấm động thay vào. */
const stripEllipsis = (text: ReactNode): ReactNode => (typeof text === "string" ? text.replace(/\s*(…|\.\.\.)$/, "") : text);

interface ElapsedTimerProps {
  /** Mốc bắt đầu (ms epoch). Không truyền ⇒ đếm từ lúc component hiện ra. */
  since?: number | null;
  /** false ⇒ dừng đếm (giữ số cuối). */
  running?: boolean;
  className?: string;
}

/** Đồng hồ `m:ss`. */
export function ElapsedTimer({ since, running = true, className = "" }: ElapsedTimerProps) {
  const [mountedAt] = useState(() => Date.now());
  const now = useNow(running);
  const start = since ?? mountedAt;
  // aria-hidden: nằm trong vùng role="status" mà đổi mỗi giây ⇒ trình đọc màn hình sẽ đọc liên tục
  return (
    <span aria-hidden className={`tabular-nums ${className}`.trim()}>
      {formatElapsed(now - start)}
    </span>
  );
}

export type ActivityRowStatus = "running" | "done" | "failed" | "todo";

interface ActivityRowProps {
  status: ActivityRowStatus;
  /** Chữ chính của dòng. */
  children: ReactNode;
  /** Tooltip của chữ chính. */
  title?: string;
  /** Chi tiết thụt dòng dưới việc. */
  details?: readonly string[];
  /** Dòng đang làm: chữ phụ đổi dần khi việc kéo dài, đếm từ `since` (ms epoch; không có ⇒ từ lúc dòng hiện ra). */
  hint?: { kind: AiWaitKind; since?: number };
  /** Nhãn nhỏ cạnh chữ (vd "Lần 2" khi soạn lại). */
  badge?: string;
  /** Phần tử cuối dòng (vd đồng hồ của lượt chạy). */
  trailing?: ReactNode;
  className?: string;
}

const TEXT_TONE: Record<ActivityRowStatus, string> = {
  running: "text-on-surface font-medium",
  done: "text-on-surface-variant",
  failed: "text-error font-medium",
  todo: "text-on-surface-subtle",
};

/** Nút tròn trên dòng thời gian: nền tông nhạt + icon cùng họ màu (không viền). */
const NODE_TONE: Record<ActivityRowStatus, string> = {
  running: "bg-primary-soft text-primary",
  done: "bg-primary-soft text-primary",
  failed: "bg-error-container text-error",
  todo: "bg-surface-container-high text-on-surface-subtle",
};

/**
 * Một việc trên dòng thời gian (là `<li>`, đặt trong `<ol>`): nút tròn bên trái nối với việc sau bằng
 * vạch 1px (đã xong ⇒ vạch tím nhạt), chữ bên phải. Đang làm: spinner + chữ ánh sáng + chữ phụ khi lâu; xong: dấu tích bật
 * nhẹ; chưa tới: chấm mờ. Dòng mới mờ dần + trượt 4px lúc xuất hiện.
 */
export function ActivityRow({ status, children, title, details = [], hint, badge, trailing, className = "" }: ActivityRowProps) {
  const t = useTranslations("aiActivity.status");
  const reduced = useReducedMotion();
  return (
    <motion.li
      // Chỉ trượt khi dòng mới xuất hiện (mount) — không animate lại theo từng lần render
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTER}
      className={`group/row relative flex gap-2.5 min-w-0 pb-2.5 last:pb-0 ${className}`.trim()}
    >
      {/* Vạch nối sang việc sau — ẩn ở việc cuối */}
      <span
        aria-hidden
        className={`absolute left-[7.5px] top-[21px] bottom-0.5 w-px rounded-full group-last/row:hidden transition-colors duration-500 ${status === "done" ? "bg-primary/25" : "bg-outline"}`}
      />
      <span aria-hidden className={`relative z-[1] mt-[3px] size-4 shrink-0 rounded-full grid place-items-center transition-colors duration-300 ${NODE_TONE[status]}`}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={status}
            className="grid place-items-center"
            initial={reduced ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? undefined : { scale: 0.4, opacity: 0, transition: EXIT }}
            transition={ICON_SPRING}
          >
            {status === "running" ? (
              <Icon name="spinner" size={10} className="animate-spin motion-reduce:animate-none" />
            ) : status === "failed" ? (
              <Icon name="warning" size={9} />
            ) : status === "done" ? (
              <Icon name="check" size={9} />
            ) : (
              <span className="size-1.5 rounded-full bg-current" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
        <span title={title ?? (typeof children === "string" ? children : undefined)} className={`min-w-0 truncate text-body leading-[22px] ${TEXT_TONE[status]}`}>
          {status === "running" ? (
            <>
              <ShimmerText>{stripEllipsis(children)}</ShimmerText>
              <TypingDots className="ml-1" />
            </>
          ) : (
            children
          )}
          <span className="sr-only">{t(status)}</span>
        </span>
        {badge && (
          <motion.span
            key={badge}
            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={ICON_SPRING}
            className="shrink-0 rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold leading-[18px] text-primary"
          >
            {badge}
          </motion.span>
        )}
        {trailing}
        </span>
        {status === "running" && hint && <RowHint kind={hint.kind} since={hint.since} />}
        {details.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-caption leading-[18px] text-on-surface-muted">
            {details.map((detail, index) => (
              <li key={index} title={detail} className="min-w-0 truncate">
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.li>
  );
}

/**
 * Chữ phụ khi một việc kéo dài: sau mỗi `HINT_INTERVAL_MS` đổi sang một câu chờ chung của loại việc (crossfade nhẹ);
 * quá ước lượng BE báo ⇒ "sắp xong". Chỉ là lời chờ, không phải tiến độ.
 */
function WaitHint({ kind, elapsed, estMs, className = "pl-5" }: { kind: AiWaitKind; elapsed: number; estMs?: number | null; className?: string }) {
  const t = useTranslations("aiActivity");
  const reduced = useReducedMotion();
  let sub: string | null = null;
  if (estMs && elapsed > estMs) sub = t("almostDone");
  else if (elapsed >= HINT_INTERVAL_MS) sub = t(`hints.${kind}.${((Math.floor(elapsed / HINT_INTERVAL_MS) - 1) % HINT_COUNT) + 1}` as `hints.generic.1`);
  return (
    <AnimatePresence initial={false} mode="wait">
      {sub && (
        <motion.p
          key={sub}
          className={`${className} text-caption text-on-surface-muted`}
          initial={reduced ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
          transition={ENTER}
        >
          {sub}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Chữ phụ cho dòng đang làm của nhật ký — đếm từ lúc dòng đó bắt đầu. */
function RowHint({ kind, since }: { kind: AiWaitKind; since?: number }) {
  const [mountedAt] = useState(() => Date.now());
  const now = useNow(true);
  return <WaitHint kind={kind} elapsed={now - (since ?? mountedAt)} className="" />;
}

interface AiWaitLineProps {
  /** Dòng chính — lấy từ sự kiện thật ("Đang soạn nội dung…"). */
  label: string;
  /** Loại việc ⇒ chọn bộ câu phụ. */
  kind?: AiWaitKind;
  /** Mốc bắt đầu (ms epoch); không truyền ⇒ từ lúc hiện ra. */
  since?: number | null;
  /** Thời gian ước tính BE báo; có ⇒ quá mốc này mới hiện "sắp xong". */
  estMs?: number | null;
  /** Ẩn đồng hồ khi chỗ chật. */
  showTimer?: boolean;
  /** false ⇒ dừng đồng hồ và chữ phụ. */
  running?: boolean;
  className?: string;
}

/** Dòng chờ chung: spinner + chữ ánh sáng + đồng hồ, chữ phụ đổi dần khi việc kéo dài. */
export function AiWaitLine({ label, kind = "generic", since, estMs, showTimer = true, running = true, className = "" }: AiWaitLineProps) {
  const [mountedAt] = useState(() => Date.now());
  const now = useNow(running);
  const elapsed = now - (since ?? mountedAt);

  // Kiểu ChatGPT: không spinner, không khung — chỉ chữ có ánh sáng chạy + ba chấm nhảy, đồng hồ mờ bên cạnh
  return (
    <div role="status" className={`flex flex-col gap-0.5 min-w-0 ${className}`.trim()}>
      <div className="flex items-baseline gap-2 text-body min-w-0">
        <span className="min-w-0 truncate font-medium">
          <ShimmerText>{stripEllipsis(label)}</ShimmerText>
          <TypingDots className="ml-1" />
        </span>
        {showTimer && <ElapsedTimer since={since ?? mountedAt} running={running} className="shrink-0 text-caption text-on-surface-subtle" />}
      </div>
      <WaitHint kind={kind} elapsed={elapsed} estMs={estMs} className="" />
    </div>
  );
}
