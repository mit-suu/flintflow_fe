import type { Variants } from "motion/react";

/*
 * Preset chuyển động của landing (thư viện `motion`). Quy ước:
 * - Chỉ animate transform / opacity; 150–450ms, ease-out khi vào; stagger 40–60ms.
 * - Mỗi chuyển động phải nói điều gì đó về sản phẩm (tiến độ chạy theo giai đoạn, tài liệu lần lượt được duyệt…),
 *   không trang trí thuần.
 * - Giảm chuyển động: `LandingMotion` bọc cả trang bằng `MotionConfig reducedMotion="user"`.
 * File này là dữ liệu thuần (không "use client") để server component import được; phần tử động dùng
 * `motion/react-client`.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Hiện dần từ dưới lên — dùng cho khối nội dung. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Khung chứa: con hiện lần lượt. */
export const stagger = (step = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

/** Thanh chạy từ trái sang (scaleX, gốc bên trái) — dùng cho thanh tiến độ và dải 12 giai đoạn. */
export const growX: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Cuộn tới mới chạy, chạy một lần. */
export const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.25 } } as const;

/** Chạy ngay khi trang tải (hero). */
export const onLoad = { initial: "hidden", animate: "show" } as const;

/** `fadeUp` rồi mới cho con chạy (stagger) — dùng cho card có nội dung động bên trong. */
export const fadeUpThen = (step = 0.12, delay = 0.3): Variants => ({
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT, staggerChildren: step, delayChildren: delay } },
});
