"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBalance } from "@/lib/api/billing";
import { listProjectsPage } from "@/lib/api/projects";

/** Hạn mức dự án của gói đang dùng (UC-16): `used` = số dự án đang làm (BE không tính dự án đã lưu trữ / đã xoá). */
export interface ProjectQuota {
  used: number;
  max: number;
  planLabel: string;
}

/**
 * Đọc hạn mức dự án để báo TRƯỚC khi điền form (E2E BarberGo #1): trần từ `GET /billing/balance` (`planLimits.maxProjects`),
 * số đã dùng từ `GET /projects?status=active` (`meta.total`) — cùng cách đếm với `assertProjectQuota` ở BE. Không đọc được
 * (mạng lỗi, BE cũ chưa có `planLimits`) ⇒ `null`: hộp vẫn cho bấm, BE vẫn chặn khi tạo. `reload` gọi lại sau khi BE từ chối.
 */
export function useProjectQuota(): { quota: ProjectQuota | null; reload: () => void } {
  const [quota, setQuota] = useState<ProjectQuota | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<ProjectQuota | null> => {
      const [balance, page] = await Promise.all([fetchBalance(), listProjectsPage({ page: 1, limit: 1, status: "active" })]);
      const max = balance.planLimits?.maxProjects;
      return typeof max === "number" ? { used: page.meta.total, max, planLabel: balance.planLabel } : null;
    };
    load()
      .catch(() => null)
      .then((next) => {
        if (alive) setQuota(next);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { quota, reload };
}
