"use client";

import { useEffect, useState } from "react";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgRole } from "@/types/organization";

export interface ActiveOrganization {
  id: string;
  name: string;
  /** Vai trò của chính người đang đăng nhập trong org này. */
  role: OrgRole;
}

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên và vai trò của người dùng trong đó. `null` khi chưa có
 * tổ chức hoặc đang tải. Dùng để: hiện tổ chức đang mở ở thanh bên (người ở nhiều tổ chức cần biết mình đang ở
 * đâu), và ẩn thao tác chỉ Lead làm được (mua credit) thay vì để bấm rồi mới báo lỗi.
 */
export const useActiveOrganization = (): ActiveOrganization | null => {
  const [org, setOrg] = useState<ActiveOrganization | null>(null);

  useEffect(() => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    let mounted = true;
    fetchOrganization(orgId)
      .then((detail) => {
        if (mounted) setOrg({ id: detail.id, name: detail.name, role: detail.role });
      })
      // Không lấy được thì thôi hiện tên — không chặn giao diện vì chuyện phụ này
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return org;
};
