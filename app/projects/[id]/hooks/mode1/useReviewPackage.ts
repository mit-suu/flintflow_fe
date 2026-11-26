"use client";

import { useEffect, useState } from "react";
import { onNotificationsChanged } from "@/lib/api/notifications";
import { getReviewPackage } from "@/lib/api/versions";
import type { ReviewPackage } from "@/types/doc-version";

/**
 * Gói thay đổi của dự án nhập SRS (`GET /review-package`) cho pill trạng thái ở thanh đầu tài liệu; tải lại khi `refreshToken`
 * đổi (CR ghi bản nháp, gửi Lead, Lead duyệt / yêu cầu sửa đều kéo theo tải lại tài liệu). `enabled = false` ⇒ không gọi.
 * FLF-480 (ChoViet #15): người khác (Lead phát hành, BA gửi gói) đổi gói ở cửa sổ khác thì cửa sổ này không có gì báo ⇒
 * đọc lại khi cửa sổ được focus lại và khi chuông thông báo có thay đổi, để pill "Chờ Lead duyệt" không kẹt tới khi tải lại.
 */
export function useReviewPackage(projectId: string, enabled: boolean, refreshToken = 0): ReviewPackage | null {
  const [pkg, setPkg] = useState<ReviewPackage | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const bump = () => setTick((n) => n + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisible);
    const off = onNotificationsChanged(bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisible);
      off();
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getReviewPackage(projectId)
      .then((res) => !cancelled && setPkg(res.data ?? null))
      // Không đọc được gói ⇒ không hiện pill; panel Kiểm & chốt vẫn báo lỗi riêng của nó
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, refreshToken, tick]);
  return enabled ? pkg : null;
}
