"use client";

import { useEffect, useState } from "react";
import { fetchOrganization, onOrganizationChanged } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgRole } from "@/types/organization";

export interface ActiveOrganization {
  id: string;
  name: string;
  /** Vai trò của chính người đang đăng nhập trong org này. */
  role: OrgRole;
}

export interface ActiveOrganizationState {
  org: ActiveOrganization | null;
  loading: boolean;
}

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên, vai trò của người dùng và trạng thái đang tải.
 * Dùng để tránh nháy UI / gọi API theo vai trò khi chưa biết org đang mở là Viewer hay Lead/Analyst.
 */
export const useActiveOrganizationState = (): ActiveOrganizationState => {
  const [state, setState] = useState<{ org: ActiveOrganization | null; settledForOrgId: string | null }>({
    org: null,
    settledForOrgId: null,
  });
  const activeOrgId = typeof window === "undefined" ? null : getActiveOrgId();

  useEffect(() => {
    if (!activeOrgId) return;
    let mounted = true;
    const load = () =>
      fetchOrganization(activeOrgId)
        .then((detail) => {
          if (mounted) {
            setState({
              org: { id: detail.id, name: detail.name, role: detail.role },
              settledForOrgId: activeOrgId,
            });
          }
        })
        // Không lấy được thì thôi hiện tên — không chặn giao diện vì chuyện phụ này
        .catch(() => {
          if (mounted) {
            setState((prev) => ({
              org: prev.settledForOrgId === activeOrgId ? prev.org : null,
              settledForOrgId: activeOrgId,
            }));
          }
        });
    void load();
    // Đổi tên tổ chức (trang Thành viên) ⇒ đọc lại để thanh bên hiện tên mới ngay
    const unsubscribe = onOrganizationChanged(() => void load());
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeOrgId]);

  if (!activeOrgId) return { org: null, loading: false };
  if (state.settledForOrgId !== activeOrgId) return { org: null, loading: true };
  return { org: state.org, loading: false };
};

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên và vai trò của người dùng trong đó. `null` khi chưa có
 * tổ chức hoặc đang tải. Dùng để: hiện tổ chức đang mở ở thanh bên (người ở nhiều tổ chức cần biết mình đang ở
 * đâu), và ẩn thao tác chỉ Lead làm được (mua credit) thay vì để bấm rồi mới báo lỗi.
 */
export const useActiveOrganization = (): ActiveOrganization | null => useActiveOrganizationState().org;
