"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { isAuthenticated, getUserRole, logoutAndRedirect } from "../lib/auth";
import { refreshSession, type RefreshOutcome } from "../lib/api";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/** Lỗi mạng / BE 5xx / cold start: thử lại vài lần trước khi báo lỗi — tuyệt đối không đăng xuất. */
export const REFRESH_RETRY_DELAYS_MS = [1000, 3000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const refreshWithRetry = async (): Promise<RefreshOutcome> => {
  let outcome = await refreshSession();
  for (const delay of REFRESH_RETRY_DELAYS_MS) {
    if (outcome !== "failed") break;
    await wait(delay);
    outcome = await refreshSession();
  }
  return outcome;
};

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  // Dùng chung với admin: `app/admin/layout.tsx` ghim provider về `vi` nên ở đó luôn là tiếng Việt.
  const t = useTranslations("app.authGuard");
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!isAuthenticated()) {
        const outcome = await refreshWithRetry();
        if (!isMounted) return;
        if (outcome === "rejected") {
          // Chờ BE xoá cookie HttpOnly rồi reload hẳn sang /login — router.replace có thể bị proxy đẩy
          // ngược về trang hiện tại (cookie accessToken còn hạn) và AuthGuard kẹt ở spinner.
          await logoutAndRedirect();
          return;
        }
        if (outcome === "failed") {
          setConnectionError(true);
          return;
        }
      }

      const role = getUserRole();
      if (requireAdmin && role !== "admin") {
        if (isMounted) router.replace("/home");
        return;
      }

      if (isMounted) setAuthorized(true);
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router, requireAdmin, attempt]);

  const retry = useCallback(() => {
    setConnectionError(false);
    setAttempt((n) => n + 1);
  }, []);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        {connectionError ? (
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-secondary">cloud_off</span>
            <p className="text-xs text-secondary font-medium">
              {t("offline")}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-primary ff-spinner">
              progress_activity
            </span>
            <p className="text-xs text-secondary font-medium">{t("checking")}</p>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
