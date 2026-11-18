/**
 * UC-10, UC-13, UC-15, UC-81 (FLF-422): thành viên bị xoá khỏi tổ chức hoặc tổ chức bị xoá giữa phiên.
 * Token cũ trong bộ nhớ vẫn mang `orgId` nên request kế tiếp dính `403 ORG_FORBIDDEN`, `409 NO_ACTIVE_ORG`,
 * hoặc `404 ORG_NOT_FOUND` trên `/orgs/<activeOrgId>`.
 *
 * Thu hồi tập trung tại `authFetch`: cưỡng bức `/auth/refresh` (BE loại `orgId` mồ côi), đếm org còn lại,
 * rồi chuyển trang một lần về `/home/organizations` (còn org) hoặc `/home/onboarding` (hết org).
 *
 * Module lá (không import `lib/api/*`) để tránh vòng import với `lib/api/client.ts` và `lib/api/orgs.ts`.
 */

export type OrgAccessRefreshOutcome = "ok" | "rejected" | "failed";

export interface OrgAccessRecoveryDeps {
  refresh: () => Promise<OrgAccessRefreshOutcome>;
  fetchOrgsCount: () => Promise<number | null>;
  redirect?: (to: string) => void;
}

const ONBOARDING_PATH = "/home/onboarding";
const ORGANIZATIONS_PATH = "/home/organizations";

const EXEMPT_EXACT_PATHS: ReadonlySet<string> = new Set([
  ONBOARDING_PATH,
  ORGANIZATIONS_PATH,
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
]);

const isExemptPath = (pathname: string): boolean =>
  EXEMPT_EXACT_PATHS.has(pathname) || pathname.startsWith("/admin");

/**
 * Chỉ coi `404 ORG_NOT_FOUND` là mất org đang mở khi endpoint nhắm đúng `/orgs/<activeOrgId>` (hoặc nhánh con),
 * tránh kích hoạt nhầm khi user bấm chuyển sang một org khác đã bị xoá (`POST /orgs/org-other/switch`).
 */
export const isActiveOrgNotFoundEndpoint = (endpoint: string, activeOrgId: string | null): boolean => {
  if (!activeOrgId) return false;
  const path = endpoint.split(/[?#]/, 1)[0];
  const prefix = `/orgs/${activeOrgId}`;
  return path === prefix || path.startsWith(`${prefix}/`);
};

export const isLostOrgError = (
  status: number,
  code: string | undefined,
  endpoint: string,
  activeOrgId: string | null
): boolean => {
  if (status === 403 && code === "ORG_FORBIDDEN") return true;
  if (status === 409 && code === "NO_ACTIVE_ORG") return true;
  if (status === 404 && code === "ORG_NOT_FOUND" && isActiveOrgNotFoundEndpoint(endpoint, activeOrgId)) return true;
  return false;
};

let recovering = false;

/** Chỉ dùng trong unit test để cô lập trạng thái chống gọi trùng giữa các test. */
export const resetOrgAccessRecoveryForTests = (): void => {
  recovering = false;
};

/**
 * Thu hồi phiên mất org đang mở. Nhiều request song song cùng dính 403/404/409 chỉ chạy đúng một lượt
 * refresh + kiểm tra `/orgs` + chuyển trang.
 */
export const recoverFromLostOrgAccess = async (deps: OrgAccessRecoveryDeps): Promise<void> => {
  if (typeof window === "undefined" || recovering) return;
  if (isExemptPath(window.location.pathname)) return;

  recovering = true;
  const redirect = deps.redirect ?? ((to: string) => window.location.replace(to));
  let redirected = false;

  try {
    const outcome = await deps.refresh();
    // Hết phiên hoặc tài khoản bị khoá: luồng /auth/refresh đã xoá token hoặc chuyển sang /login.
    if (outcome === "rejected") return;

    let target = ORGANIZATIONS_PATH;
    try {
      const count = await deps.fetchOrgsCount();
      if (count === null) return;
      if (count === 0) target = ONBOARDING_PATH;
    } catch {
      // Lỗi tạm thời khi đọc GET /orgs: vẫn thoát khỏi màn hình lỗi của org cũ về bộ chọn tổ chức.
    }

    redirected = true;
    redirect(target);
  } finally {
    if (!redirected) recovering = false;
  }
};
