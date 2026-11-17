"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import PageSkeleton from "@/components/ui/PageSkeleton";
import Skeleton from "@/components/ui/Skeleton";
import { fetchMe } from "@/lib/api/users";
import { isAccountLocaleSettled, useAccountLocaleSync } from "@/lib/hooks/use-account-locale";
import type { WorkspaceMemory } from "@/lib/workspace-memory";
import type { User } from "@/types/user";
import type { OrgRole } from "@/types/organization";
import WorkspaceLoading from "./[id]/_components/WorkspaceLoading";

/**
 * Bản nhớ hiển thị server đọc từ cookie (`app/projects/layout.tsx`), dùng để khung đang tải của workspace dựng đúng bố cục
 * ngay từ HTML đầu tiên — cả lúc còn chờ đăng nhập lẫn lúc trang đã chạy mà dữ liệu chưa về (cùng một `WorkspaceLoading`).
 */
export interface WorkspaceBoot {
  memory: WorkspaceMemory | null;
  /** Dự án đang ở màn đọc file SRS (cookie `ff-import-pending-<id>`). */
  importPendingIds: readonly string[];
  profileName: string | null;
  orgRole: OrgRole | null;
}

const EMPTY: WorkspaceBoot = { memory: null, importPendingIds: [], profileName: null, orgRole: null };
const WorkspaceBootContext = createContext<WorkspaceBoot>(EMPTY);

export const useWorkspaceBoot = () => useContext(WorkspaceBootContext);
/** Cấp bản nhớ cho cây con (layout dùng; test truyền bản nhớ giả). */
export const WorkspaceBootProvider = WorkspaceBootContext.Provider;

/** `/projects/<id>` đúng trang workspace (không phải `/view`, `/gap-report`…). */
const WORKSPACE_PATH = /^\/projects\/([^/]+)$/;

function ProjectsAuthSkeleton({ label }: { label: string }) {
  const pathname = usePathname();
  const t = useTranslations("app.authGuard");
  const projectId = pathname.match(WORKSPACE_PATH)?.[1];
  if (projectId) return <WorkspaceLoading projectId={projectId} />;
  // Trang con (đọc tài liệu, gap report…): khối giữ chỗ chung như trước
  return (
    <div className="min-h-screen bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-6 mx-auto max-w-[1100px]">
        <Skeleton className="h-7 w-52" />
        <PageSkeleton label={label || t("checking")} />
      </div>
    </div>
  );
}

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

/** Phần client của `app/projects/layout.tsx`: xác thực (kèm khung chờ đúng trang) + đồng bộ ngôn ngữ tài khoản. */
export default function ProjectsLayoutClient({ boot, children }: { boot: WorkspaceBoot; children: ReactNode }) {
  return (
    <WorkspaceBootProvider value={boot}>
      <AuthGuard renderSkeleton={(label) => <ProjectsAuthSkeleton label={label} />}>
        <ProjectsAccountLocaleSync />
        {children}
      </AuthGuard>
    </WorkspaceBootProvider>
  );
}
