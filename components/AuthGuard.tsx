"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUserRole, clearAuthToken } from "../lib/auth";
import { refreshAccessToken } from "../lib/api";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!isAuthenticated()) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuthToken();
          if (isMounted) router.replace("/login");
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
  }, [router, requireAdmin]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-primary ff-spinner">
            progress_activity
          </span>
          <p className="text-xs text-secondary font-medium">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
