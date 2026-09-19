"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Bọc landing: tôn trọng cài đặt "giảm chuyển động" của hệ điều hành (bỏ transform, chỉ còn mờ dần). */
export default function LandingMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
