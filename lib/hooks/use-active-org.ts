"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchOrganization, onOrganizationChanged } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { readActiveOrgCache, writeActiveOrgCache, type ActiveOrganization } from "@/lib/active-org-cache";

export type { ActiveOrganization } from "@/lib/active-org-cache";

export interface ActiveOrganizationState {
  org: ActiveOrganization | null;
  loading: boolean;
  error: boolean;
}

// ─── store dùng chung cả app: thanh bên, menu tài khoản, các trang theo vai trò cùng đọc một nguồn, một request ───

/** Kết quả lần đọc BE gần nhất cho `orgId`. `null` khi chưa đọc xong lần nào. */
interface Settled {
  orgId: string;
  org: ActiveOrganization | null;
  error: boolean;
}

let settled: Settled | null = null;
let inflight: { orgId: string; promise: Promise<void> } | null = null;
const listeners = new Set<() => void>();

const publish = (next: Settled) => {
  settled = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Đọc lại tổ chức từ BE. Nhiều chỗ cùng gọi trong một lượt ⇒ dùng chung một request. Mỗi lần một trang dùng hook
 * được mở là một lần đọc lại (vai trò có thể vừa bị đổi ở nơi khác), và đọc lại khi có sự kiện đổi tổ chức.
 */
const revalidate = (orgId: string): Promise<void> => {
  if (inflight?.orgId === orgId) return inflight.promise;
  const promise = fetchOrganization(orgId)
    .then((detail) => {
      const org: ActiveOrganization = { id: detail.id, name: detail.name, role: detail.role };
      writeActiveOrgCache(org);
      publish({ orgId, org, error: false });
    })
    // Không đọc được: còn bản đã biết (lần đọc trước / bản nhớ) thì giữ để hiện tên; không còn gì ⇒ error để phần
    // theo vai trò (billing) fail closed
    .catch(() => {
      const known = (settled?.orgId === orgId ? settled.org : null) ?? readActiveOrgCache(orgId);
      publish({ orgId, org: known, error: known === null });
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { orgId, promise };
  return promise;
};

/** Chỉ cho test: đưa store về trạng thái chưa đọc gì. */
export const resetActiveOrganizationStore = () => {
  settled = null;
  inflight = null;
};

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên, vai trò của người dùng, trạng thái đang tải và lỗi.
 *
 * Có bản nhớ từ lần trước (`active-org-cache`) ⇒ trả ngay `loading: false` với bản nhớ, đọc lại ngầm rồi cập nhật.
 * Chưa nhớ gì (lần đầu trên máy này) ⇒ `loading: true` tới khi BE trả lời; dùng để fail-closed (ẩn UI / không gọi
 * API theo vai trò) khi chưa biết hoặc không tải được org đang mở.
 */
export const useActiveOrganizationState = (): ActiveOrganizationState => {
  const current = useSyncExternalStore(subscribe, () => settled, () => null);
  const activeOrgId = typeof window === "undefined" ? null : getActiveOrgId();

  useEffect(() => {
    if (!activeOrgId) return;
    void revalidate(activeOrgId);
    // Đổi tên tổ chức / đổi vai trò (trang Thành viên) ⇒ đọc lại để thanh bên hiện ngay
    return onOrganizationChanged(() => void revalidate(activeOrgId));
  }, [activeOrgId]);

  if (!activeOrgId) return { org: null, loading: false, error: false };
  if (current?.orgId === activeOrgId) return { org: current.org, loading: false, error: current.error };
  const cached = readActiveOrgCache(activeOrgId);
  return cached ? { org: cached, loading: false, error: false } : { org: null, loading: true, error: false };
};

/**
 * Tổ chức đang mở (claim `orgId` trong token) kèm tên và vai trò của người dùng trong đó. `null` khi chưa có
 * tổ chức hoặc đang tải. Dùng để: hiện tổ chức đang mở ở thanh bên (người ở nhiều tổ chức cần biết mình đang ở
 * đâu), và ẩn thao tác chỉ Lead làm được (mua credit) thay vì để bấm rồi mới báo lỗi.
 */
export const useActiveOrganization = (): ActiveOrganization | null => useActiveOrganizationState().org;
