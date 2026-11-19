"use client";

import { useEffect, useState } from "react";
import { getReviewPackage } from "@/lib/api/versions";
import type { ReviewPackage } from "@/types/doc-version";

/**
 * Gói thay đổi của dự án nhập SRS (`GET /review-package`) cho pill trạng thái ở thanh đầu tài liệu; tải lại khi `refreshToken`
 * đổi (CR ghi bản nháp, gửi Lead, Lead duyệt / yêu cầu sửa đều kéo theo tải lại tài liệu). `enabled = false` ⇒ không gọi.
 */
export function useReviewPackage(projectId: string, enabled: boolean, refreshToken = 0): ReviewPackage | null {
  const [pkg, setPkg] = useState<ReviewPackage | null>(null);
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
  }, [projectId, enabled, refreshToken]);
  return enabled ? pkg : null;
}
