"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getActiveOrgId } from "@/lib/api/token-store";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import PageSkeleton from "@/components/ui/PageSkeleton";

export const ONBOARDING_PATH = "/home/onboarding";
export const ORGANIZATIONS_PATH = "/home/organizations";

/**
 * Mọi tài nguyên của tổ chức đòi access token mang `orgId`; thiếu thì BE trả `409 NO_ACTIVE_ORG`
 * (BPMN Flow 10.6). Guard này chặn trước để người dùng không gặp màn lỗi trống.
 *
 * Bốn trường hợp:
 * - token đã có `orgId` ⇒ vào thẳng, không tốn request nào;
 * - token chưa có nhưng tài khoản thuộc đúng 1 org ⇒ tự mở org đó rồi tải lại trang;
 * - token chưa có và thuộc >= 2 org ⇒ đưa sang `/home/organizations` để chọn tổ chức (Flow 7.13 / UC-10);
 * - chưa thuộc org nào ⇒ sang onboarding để tạo org hoặc nhập mã mời (Flow 8).
 */
export default function OrgGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("app.org.guard");
  const exempt = pathname === ONBOARDING_PATH || pathname === ORGANIZATIONS_PATH;
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
        if (orgs.length > 1) {
          router.replace(ORGANIZATIONS_PATH);
          return;
        }
        await switchOrganization(orgs[0].id);
        // Tải lại hẳn, không setReady: ProjectsProvider ở layout đã tải dự án bằng token cũ (⇒ 409) và giữ lỗi đó
        // nếu chỉ render lại. Lần tải sau token đã có orgId ⇒ vào thẳng, không vòng lặp.
        if (mounted) window.location.reload();
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
