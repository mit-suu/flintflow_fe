"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getActiveOrgId } from "@/lib/api/token-store";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import PageSkeleton from "@/components/ui/PageSkeleton";

export const ONBOARDING_PATH = "/home/onboarding";
export const ORGANIZATIONS_PATH = "/home/organizations";
export const PROFILE_PATH = "/home/profile";

/**
 * Mọi tài nguyên của tổ chức đòi access token mang `orgId`; thiếu thì BE trả `409 NO_ACTIVE_ORG`
 * (BPMN Flow 10.6). Guard này chặn trước để người dùng không gặp màn lỗi trống.
 *
 * Miễn trừ: onboarding, organizations, profile.
 * Khi chưa có org:
 * - 0 org ⇒ /home/onboarding
 * - 1 org ⇒ tự chọn org duy nhất rồi reload
 * - >= 2 orgs ⇒ nếu có org mặc định (isDefault) thì tự chọn rồi reload, ngược lại sang /home/organizations
 */
export default function OrgGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("app.org.guard");
  const exempt =
    pathname === ONBOARDING_PATH ||
    pathname === ORGANIZATIONS_PATH ||
    pathname === PROFILE_PATH;
  // Chỉ quyết định lúc mount: thiếu org thì luôn kết thúc bằng điều hướng/tải lại trang, không render lại tại chỗ.
  const [ready] = useState(() => Boolean(getActiveOrgId()));

  useEffect(() => {
    if (ready || exempt) return;
    let mounted = true;

    const resolveOrg = async () => {
      try {
        const orgs = await fetchMyOrganizations();
        if (!mounted) return;
        if (orgs.length === 0) {
          router.replace(ONBOARDING_PATH);
          return;
        }
        if (orgs.length === 1) {
          await switchOrganization(orgs[0].id);
          if (mounted) window.location.reload();
          return;
        }
        const defaultOrg = orgs.find((o) => o.isDefault);
        if (defaultOrg) {
          await switchOrganization(defaultOrg.id);
          if (mounted) window.location.reload();
          return;
        }
        router.replace(ORGANIZATIONS_PATH);
      } catch {
        // Không đọc được danh sách org (hết phiên, BE lỗi) — để onboarding xử lý, đừng kẹt ở spinner.
        if (mounted) router.replace(ONBOARDING_PATH);
      }
    };

    resolveOrg();
    return () => {
      mounted = false;
    };
  }, [ready, exempt, router]);

  if (exempt) return <>{children}</>;

  if (!ready) {
    // Theo flf-196: khối giữ chỗ thay cho spinner giữa trang (cùng cách AuthGuard làm)
    return (
      <div className="p-6 sm:p-8">
        <PageSkeleton label={t("checking")} className="mx-auto max-w-[1100px]" />
      </div>
    );
  }

  return <>{children}</>;
}
