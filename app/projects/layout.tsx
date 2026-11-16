"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { fetchMe } from "@/lib/api/users";
import { isAccountLocaleSettled, useAccountLocaleSync } from "@/lib/hooks/use-account-locale";
import type { User } from "@/types/user";

/**
 * Đồng bộ ngôn ngữ tài khoản cho khu `/projects/*` (FLF-427, UC-71):
 * Khi mở thẳng trang dự án (không qua /home) trên thiết bị mới, đồng bộ locale đã lưu trong tài khoản.
 * Nếu đã đồng bộ trước đó (SPA nav từ /home), bỏ qua để không fetch lặp `GET /users/me`.
 */
function ProjectsAccountLocaleSync() {
  const [me, setMe] = useState<User | null>(null);
  useAccountLocaleSync(me);

  useEffect(() => {
    if (isAccountLocaleSettled()) return;
    let mounted = true;
    fetchMe()
      .then((profile) => {
        if (mounted) setMe(profile);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return null;
}

/**
 * Access token chỉ nằm trong bộ nhớ ⇒ tải lại trang là phải refresh trước khi đọc claim (org, vai trò):
 * workspace và trang đọc tài liệu cần `orgId` ngay lúc mount để nhận ra Viewer.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ProjectsAccountLocaleSync />
      {children}
    </AuthGuard>
  );
}
