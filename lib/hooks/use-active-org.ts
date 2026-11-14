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
  error: boolean;
}

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên, vai trò của người dùng, trạng thái đang tải và lỗi.
 * Dùng để fail-closed (ẩn UI / không gọi API theo vai trò) khi chưa biết hoặc không tải được org đang mở.
 */
export const useActiveOrganizationState = (): ActiveOrganizationState => {
  const [state, setState] = useState<{
    org: ActiveOrganization | null;
    settledForOrgId: string | null;
    error: boolean;
  }>({
    org: null,
    settledForOrgId: null,
    error: false,
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
              error: false,
            });
          }
        })
        // Không lấy được thì thôi hiện tên — không chặn giao diện chính, nhưng đặt error: true để phần billing fail closed
        .catch(() => {
          if (mounted) {
            setState((prev) => {
              const keepOrg = prev.settledForOrgId === activeOrgId ? prev.org : null;
              return {
                org: keepOrg,
                settledForOrgId: activeOrgId,
                error: keepOrg === null,
              };
            });
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

  if (!activeOrgId) return { org: null, loading: false, error: false };
  if (state.settledForOrgId !== activeOrgId) return { org: null, loading: true, error: false };
  return { org: state.org, loading: false, error: state.error };
};

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên và vai trò của người dùng trong đó. `null` khi chưa có
 * tổ chức hoặc đang tải. Dùng để: hiện tổ chức đang mở ở thanh bên (người ở nhiều tổ chức cần biết mình đang ở
 * đâu), và ẩn thao tác chỉ Lead làm được (mua credit) thay vì để bấm rồi mới báo lỗi.
 */
export const useActiveOrganization = (): ActiveOrganization | null => useActiveOrganizationState().org;
