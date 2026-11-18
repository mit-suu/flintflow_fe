import { cookies } from "next/headers";
import HomeLayoutClient from "@/components/layout/HomeLayoutClient";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/components/layout/sidebar-config";
import { ACTIVE_ORG_COOKIE, parseActiveOrgCookie } from "@/lib/active-org-cache";
import { PROFILE_NAME_COOKIE, parseProfileNameCookie } from "@/lib/profile-name-cache";

/**
 * Server component chỉ để đọc cookie bản nhớ hiển thị: tổ chức đang mở, tên hồ sơ, sidebar thu gọn. Khung chờ xác thực
 * dựng ở HTML server nhờ đó đã có tên tổ chức, mục Credits (ẩn với Viewer), chip credits, avatar đúng chữ và đúng bề ngang
 * sidebar, không chen vào hay đổi hình sau khi hydrate. Phần còn lại ở client.
 */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const remembered = {
    org: parseActiveOrgCookie(store.get(ACTIVE_ORG_COOKIE)?.value),
    profileName: parseProfileNameCookie(store.get(PROFILE_NAME_COOKIE)?.value)?.name ?? null,
    sidebarCollapsed: store.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1",
  };
  return <HomeLayoutClient remembered={remembered}>{children}</HomeLayoutClient>;
}
