"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Sau khi cuộn mượt xong, chờ ngần này rồi căn lại một lần (phần nằm ngoài khung nhìn đổi cao khi hiện ra). */
const SETTLE_MS = 700;
/** Lệch quá ngần này px so với vị trí đích thì căn lại. */
const SETTLE_TOLERANCE_PX = 24;
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export interface UseAiFollowOptions {
  /** Vùng cuộn chứa các mục. */
  containerRef: RefObject<HTMLElement | null>;
  /** Mã các mục AI đang làm, theo thứ tự trong tài liệu (tính lại mỗi lần poll cũng được — mục đang xem giữ theo mã). */
  activeIds: readonly string[];
  /** Tìm phần tử của một mã (vd `container.querySelector('[data-section-id="…"]')`). */
  getElement: (id: string) => HTMLElement | null;
  /** Khoảng chừa phía trên (thanh dính) khi căn mục lên đầu khung. */
  topOffset?: number;
  /** Mặc định bật theo dõi. */
  defaultFollowing?: boolean;
  /** Phím `[` `]` nhảy giữa các mục đang làm. Mặc định bật. */
  keyboard?: boolean;
}

export interface AiFollow {
  /** Đang tự cuộn theo AI. */
  following: boolean;
  /** Bật lại ⇒ cuộn ngay tới mục đang làm đầu tiên; tắt ⇒ giữ nguyên chỗ đang xem. */
  setFollowing: (on: boolean) => void;
  /** Mục đang xem (theo AI khi đang theo dõi, theo lựa chọn của người dùng khi không). */
  viewedId: string | null;
  /** Tổng số mục đang làm. */
  total: number;
  /** Vị trí (1..total) của mục đang xem trong các mục đang làm; 0 khi mục đang xem đã xong. */
  index: number;
  /** Nhảy tới mục đang làm trước / sau (vòng tròn). Tắt theo dõi. */
  prev: () => void;
  next: () => void;
  /** Nhảy tới một mục bất kỳ (bấm dòng ở danh sách bên cạnh). Tắt theo dõi. */
  jumpTo: (id: string) => void;
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Theo dõi AI trong một vùng cuộn: tự cuộn mượt tới mục đang làm đầu tiên, người dùng cuộn tay (lăn chuột, chạm, phím, kéo
 * thanh cuộn) thì tắt; ‹ › và phím `[` `]` nhảy giữa các mục đang làm. Không biết gì về loại mục — chỉ cần mã, vùng cuộn và
 * cách tìm phần tử, nên dùng lại được cho khung tài liệu của workspace (`[data-section-id]`).
 *
 * Cuộn do code không bị nhầm với cuộn tay: chỉ các sự kiện đầu vào của người dùng mới tắt theo dõi, không nghe `scroll`.
 * Giảm chuyển động ⇒ nhảy thẳng, không cuộn mượt.
 */
export function useAiFollow({ containerRef, activeIds, getElement, topOffset = 56, defaultFollowing = true, keyboard = true }: UseAiFollowOptions): AiFollow {
  const [following, setFollowingState] = useState(defaultFollowing);
  // Mục người dùng chọn tay; chỉ có nghĩa khi không theo dõi
  const [manualId, setManualId] = useState<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leadId = activeIds[0] ?? null;
  const viewedId = following ? leadId : manualId;
  const total = activeIds.length;
  const index = viewedId ? activeIds.indexOf(viewedId) + 1 : 0;

  // Giữ bản mới nhất cho các handler dài hạn (tránh gắn lại listener mỗi lần poll)
  const latest = useRef({ getElement, topOffset, activeIds, viewedId, following });
  useEffect(() => {
    latest.current = { getElement, topOffset, activeIds, viewedId, following };
  });

  const scrollToId = useCallback(
    (id: string) => {
      const container = containerRef.current;
      const el = latest.current.getElement(id);
      if (!container || !el) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      const targetTop = () => container.scrollTop + (el.getBoundingClientRect().top - container.getBoundingClientRect().top) - latest.current.topOffset;
      const smooth = !prefersReducedMotion();
      container.scrollTo({ top: Math.max(targetTop(), 0), behavior: smooth ? "smooth" : "auto" });
      // Mục xa hiện ra thì đổi cao (nội dung nạp muộn) ⇒ đích lệch; căn lại một lần sau khi cuộn mượt xong
      if (smooth) {
        settleTimer.current = setTimeout(() => {
          if (Math.abs(container.scrollTop - Math.max(targetTop(), 0)) > SETTLE_TOLERANCE_PX) container.scrollTo({ top: Math.max(targetTop(), 0), behavior: "auto" });
        }, SETTLE_MS);
      }
    },
    [containerRef]
  );

  // Theo dõi: cuộn khi mục đang làm đầu tiên đổi (hoặc vừa bật lại)
  useEffect(() => {
    if (following && leadId) scrollToId(leadId);
  }, [following, leadId, scrollToId]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );

  const stopFollowing = useCallback(() => {
    if (!latest.current.following) return;
    setManualId(latest.current.viewedId);
    setFollowingState(false);
  }, []);

  // Người dùng tự cuộn ⇒ tắt. Chỉ nghe thao tác của người dùng, nên cuộn do code không bị tính nhầm
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onPointerDown = (e: PointerEvent) => {
      // Bấm vào thanh cuộn (nằm ngoài vùng nội dung): chính container là target và toạ độ rơi vào dải thanh cuộn
      if (e.target === container && e.clientX >= container.getBoundingClientRect().left + container.clientWidth) stopFollowing();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key) && !(e.target as HTMLElement | null)?.closest?.(EDITABLE)) stopFollowing();
    };
    container.addEventListener("wheel", stopFollowing, { passive: true });
    container.addEventListener("touchmove", stopFollowing, { passive: true });
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("wheel", stopFollowing);
      container.removeEventListener("touchmove", stopFollowing);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef, stopFollowing]);

  const jumpTo = useCallback(
    (id: string) => {
      setFollowingState(false);
      setManualId(id);
      scrollToId(id);
    },
    [scrollToId]
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const { activeIds: ids, viewedId: current } = latest.current;
      if (ids.length === 0) return;
      const at = current ? ids.indexOf(current) : -1;
      const nextIndex = at < 0 ? (dir === 1 ? 0 : ids.length - 1) : (at + dir + ids.length) % ids.length;
      jumpTo(ids[nextIndex]);
    },
    [jumpTo]
  );
  const prev = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);

  const setFollowing = useCallback(
    (on: boolean) => {
      if (on) {
        setManualId(null);
        setFollowingState(true);
      } else stopFollowing();
    },
    [stopFollowing]
  );

  useEffect(() => {
    if (!keyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== "[" && e.key !== "]") || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.(EDITABLE)) return;
      if (latest.current.activeIds.length === 0) return;
      e.preventDefault();
      step(e.key === "]" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboard, step]);

  return { following, setFollowing, viewedId, total, index, prev, next, jumpTo };
}
