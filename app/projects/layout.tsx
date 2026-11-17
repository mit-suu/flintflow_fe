import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE, parseActiveOrgCookie } from "@/lib/active-org-cache";
import { IMPORT_PENDING_COOKIE_PREFIX } from "@/lib/import-pending";
import { PROFILE_NAME_COOKIE, parseProfileNameCookie } from "@/lib/profile-name-cache";
import { WORKSPACE_MEMORY_COOKIE, parseWorkspaceMemory } from "@/lib/workspace-memory";
import ProjectsLayoutClient from "./workspace-boot";

/**
 * Access token chỉ nằm trong bộ nhớ ⇒ tải lại trang là phải refresh trước khi đọc claim (org, vai trò):
 * workspace và trang đọc tài liệu cần `orgId` ngay lúc mount để nhận ra Viewer.
 *
 * Server component chỉ để đọc cookie bản nhớ (dự án mở gần nhất, dự án đang đọc file SRS, tên hồ sơ, vai trò trong tổ
 * chức): khung đang tải của workspace dựng đúng bố cục ngay trong HTML đầu tiên, trong lúc chờ đăng nhập.
 */
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const boot = {
    memory: parseWorkspaceMemory(store.get(WORKSPACE_MEMORY_COOKIE)?.value),
    importPendingIds: store
      .getAll()
      .filter((c) => c.name.startsWith(IMPORT_PENDING_COOKIE_PREFIX) && c.value === "1")
      .map((c) => c.name.slice(IMPORT_PENDING_COOKIE_PREFIX.length)),
    profileName: parseProfileNameCookie(store.get(PROFILE_NAME_COOKIE)?.value)?.name ?? null,
    orgRole: parseActiveOrgCookie(store.get(ACTIVE_ORG_COOKIE)?.value)?.role ?? null,
  };
  return <ProjectsLayoutClient boot={boot}>{children}</ProjectsLayoutClient>;
}
