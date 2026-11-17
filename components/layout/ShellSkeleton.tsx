"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";
import PageSkeleton from "@/components/ui/PageSkeleton";
import Avatar from "@/components/ui/Avatar";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import type { ActiveOrganization } from "@/lib/active-org-cache";
import type { OrgRole } from "@/types/organization";
import { OrganizationsLoading, ProfileLoading } from "@/components/page-shells/AccountPagesShell";
import { BillingLoading } from "@/components/page-shells/BillingShell";
import { LibraryLoading } from "@/components/page-shells/LibraryShell";
import { MembersLoading } from "@/components/page-shells/MembersShell";
import { NotificationsLoading } from "@/components/page-shells/NotificationsShell";
import { NewProjectButton, ProjectsLoading, ProjectsSearch } from "@/components/page-shells/ProjectsShell";
import { OrgSwitcherPlaceholder } from "./OrgSwitcher";
import RecentProjects from "./RecentProjects";
import SidebarNavItem, { SIDEBAR_ROW, SIDEBAR_ROW_IDLE, sidebarRowLayout } from "./SidebarNavItem";
import { SIDEBAR_SECTIONS, isSidebarItemActive } from "./sidebar-config";

/**
 * Khung `/home/*` vẽ trong lúc `AuthGuard` còn đợi `/auth/refresh` (mỗi lần tải lại trang: token chỉ nằm trong bộ nhớ).
 *
 * Phần cố định vẽ thật: logo, các mục điều hướng, dòng tổ chức (icon + mũi tên), breadcrumb, nút đổi ngôn ngữ, icon chip
 * credits; thân là chính bản đang tải của trang (tiêu đề, nút, bộ lọc thật, chỉ vùng dữ liệu là khối giữ chỗ). Tên tổ chức, mục Credits và chip lấy từ bản nhớ lần trước (cookie, server đọc sẵn nên có
 * ngay trong HTML); chưa nhớ thì chỉ tên là thanh giữ chỗ và Credits ẩn như sidebar thật khi chưa biết vai trò. Số
 * credit và thân trang là khối giữ chỗ; avatar theo tên đã nhớ, chưa nhớ thì logo FlintFlow. Cùng hình học với `AppShell` + `AppSidebar` + `TopBar` nên lúc khung
 * thật thế vào không có gì nhảy.
 */

/** Những gì khung chờ biết từ bản nhớ, đưa cho bản đang tải của trang. */
interface PageContext {
  role: OrgRole | null;
  orgName: string | null;
  /** Như trang Dự án: chỉ Viewer (biết chắc) mới không tạo được. */
  canAuthor: boolean;
}

const noop = () => undefined;

/**
 * Mỗi trang `/home/*`: breadcrumb (đúng key i18n trang đó truyền cho `TopBar`), phần thêm của thanh trên, và thân trang
 * lúc đang tải — CHÍNH bản đang tải mà trang thật dùng (`components/page-shells/*`). Nhờ vậy lúc tải lại, khung chờ đăng
 * nhập và trang đang tải trùng nhau, chỉ một nấc. Thêm trang mới thì thêm dòng ở đây; trang không có trong bảng thì
 * breadcrumb và thân là khối giữ chỗ chung.
 */
const ACCOUNT = "app.common.account";
const PAGES: Record<string, { trail: readonly string[]; search?: () => ReactNode; actions?: (ctx: PageContext) => ReactNode; body: (ctx: PageContext) => ReactNode }> = {
  "/home": {
    trail: ["app.home.projectsTitle"],
    search: () => <ProjectsSearch value="" onChange={noop} />,
    actions: ({ canAuthor }) => (canAuthor ? <NewProjectButton onClick={noop} /> : null),
    body: ({ canAuthor }) => <ProjectsLoading canAuthor={canAuthor} />,
  },
  "/home/notifications": { trail: [ACCOUNT, "app.notifications.title"], body: () => <NotificationsLoading /> },
  "/home/members": { trail: [ACCOUNT, "app.org.members.title"], body: ({ role, orgName }) => <MembersLoading role={role} orgName={orgName} /> },
  "/home/library": { trail: [ACCOUNT, "app.org.library.title"], body: ({ role }) => <LibraryLoading role={role} /> },
  "/home/billing": { trail: [ACCOUNT, "app.billing.title"], body: ({ role }) => <BillingLoading role={role} /> },
  "/home/profile": { trail: [ACCOUNT, "app.profile.breadcrumb"], body: () => <ProfileLoading /> },
  "/home/organizations": { trail: [ACCOUNT, "app.org.switcher.title"], body: () => <OrganizationsLoading /> },
};

/**
 * Bản nhớ hiển thị server đọc từ cookie (`app/home/layout.tsx`). Token chưa có (đang xác thực) nên chưa biết orgId hay
 * userId: dùng bản nhớ gần nhất. Đăng xuất đã xoá bản nhớ, nên đây là của chính người này; lệch thì khung thật sửa lại
 * ngay sau khi xác thực.
 */
export interface ShellMemory {
  org: ActiveOrganization | null;
  /** Tên hồ sơ cho avatar; `null` ⇒ avatar là logo FlintFlow. */
  profileName: string | null;
  /** Sidebar đang thu gọn ⇒ HTML đầu tiên đã đúng bề ngang. */
  sidebarCollapsed: boolean;
}

export default function ShellSkeleton({ label, remembered }: { label: string; remembered: ShellMemory }) {
  const { org: rememberedOrg, profileName, sidebarCollapsed } = remembered;
  const t = useTranslations("app.shell");
  // Key lấy từ bảng tĩnh ở trên, không phải chuỗi người dùng nhập ⇒ dùng `t` gốc với key đầy đủ
  const tRoot = useTranslations() as unknown as (key: string) => string;
  const pathname = usePathname();
  const page = PAGES[pathname] ?? null;
  const role = rememberedOrg?.role ?? null;
  const ctx: PageContext = { role, orgName: rememberedOrg?.name ?? null, canAuthor: role !== "viewer" };
  const collapsed = sidebarCollapsed;
  // Như sidebar thật: chỉ hiện Credits khi biết chắc không phải Viewer
  const showBilling = rememberedOrg !== null && rememberedOrg.role !== "viewer";

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-container-lowest">
      <aside aria-label={t("nav")} className="hidden md:block h-dvh bg-surface-sidebar p-3 pl-0 pr-4 rounded-r-2xl">
        <div
          className={`h-full flex flex-col rounded-r-[20px] bg-surface-container-lowest shadow-[0_1px_2px_rgba(25,24,23,0.04),0_8px_24px_rgba(25,24,23,0.05)] py-4 ${
            collapsed ? "w-[64px] px-2" : "w-[232px] px-3"
          }`}
        >
          <div className={`flex items-center h-11 mb-5 gap-2 pt-3 ${collapsed ? "justify-center" : "px-5"}`}>
            {collapsed ? (
              <Logo variant="icon" sizeClassName="w-7 h-7" theme="light" />
            ) : (
              <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" />
            )}
          </div>
          {/* Cùng lớp cuộn như sidebar thật (`ff-scroll` chừa rãnh thanh cuộn) ⇒ ô mục đang chọn rộng đúng bằng bản thật */}
          <div className={`flex-1 min-h-0 flex flex-col gap-6 ${collapsed ? "overflow-visible" : "ff-scroll overflow-y-auto"}`}>
            {SIDEBAR_SECTIONS.map((section) => (
              <nav key={section.id} aria-label={section.labelKey ? t(section.labelKey) : t("sectionMain")} className="flex flex-col gap-1">
                {section.labelKey &&
                  (collapsed ? (
                    <div aria-hidden className="h-px bg-on-surface/[0.07] mx-2 mb-2" />
                  ) : (
                    <div className="px-3 pb-1 text-body font-medium text-on-surface-muted">{t(section.labelKey)}</div>
                  ))}
                {/* Dòng tổ chức: tên lấy từ bản nhớ lần trước, chưa nhớ thì chỉ tên là thanh giữ chỗ */}
                {section.id === "org" && <OrgSwitcherPlaceholder name={rememberedOrg?.name} collapsed={collapsed} />}
                {section.items
                  .filter((item) => item.id !== "billing" || showBilling)
                  .map((item) => (
                    <SidebarNavItem
                      key={item.id}
                      item={item}
                      collapsed={collapsed}
                      active={item.status === "ready" && isSidebarItemActive(item, pathname)}
                    />
                  ))}
              </nav>
            ))}
            {/* Nhóm "Gần đây": cùng bản đang tải với sidebar thật */}
            {!collapsed && <RecentProjects projects={[]} loading />}
          </div>
          {/* Dòng "Góp ý" ở đáy: chỉ giữ chỗ cho đúng hình, bấm được khi khung thật thế vào */}
          <div className="pt-3">
            <div aria-hidden className={`${SIDEBAR_ROW} ${SIDEBAR_ROW_IDLE} ${sidebarRowLayout(collapsed)}`}>
              <Icon name="feedback" size={19} />
              {collapsed ? null : t("feedback")}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Cùng hình với `TopBar`: breadcrumb là chữ cố định của trang ⇒ vẽ thật; số credit và ảnh đại diện là dữ liệu */}
        <header className="shrink-0 bg-surface-container-lowest">
          <div className="min-h-[58px] flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-2.5">
            <span aria-hidden className="md:hidden -ml-1 grid size-9 place-items-center text-on-surface-variant">
              <Icon name="menu" size={18} />
            </span>
            {page ? (
              <nav aria-label={t("breadcrumb")} className="min-w-0 flex items-center gap-1.5 text-body">
                {page.trail.slice(0, -1).map((key) => (
                  <span key={key} className="hidden sm:flex items-center gap-1.5 text-on-surface-muted">
                    {tRoot(key)}
                    <span aria-hidden className="text-on-surface-subtle">/</span>
                  </span>
                ))}
                <span className="font-bold text-on-surface truncate">{tRoot(page.trail[page.trail.length - 1])}</span>
              </nav>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
            {page?.search && <div className="order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-[320px] md:ml-4">{page.search()}</div>}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {page?.actions?.(ctx)}
              <LocaleSwitcher />
              {showBilling && (
                <span className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-control bg-surface-container-high">
                  <Icon name="wallet" size={14} className="text-primary" />
                  <Skeleton className="h-3 w-20" />
                </span>
              )}
              <Avatar name={profileName} brandFallback />
            </div>
          </div>
        </header>
        {page ? (
          page.body(ctx)
        ) : (
          <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
              <Skeleton className="h-7 w-52" />
              <PageSkeleton label={label} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
