"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, Icon, LINK_PRIMARY, LINK_SECONDARY, PageSkeleton } from "@/components/ui";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { Organization } from "@/types/organization";
import { ONBOARDING_PATH } from "@/components/OrgGuard";
import { userErrorMessage } from "@/lib/api/error-messages";

/**
 * UC-10 / BPMN Flow 9.3–9.4 (và 7.13 khi có nhiều org) — chọn tổ chức để làm việc. Dự án, ví và vai trò
 * đều đi theo org đang mở.
 */
export default function OrganizationsPage() {
  const t = useTranslations("app.org.switcher");
  const tRoles = useTranslations("app.org.roles");
  const tc = useTranslations("app.common");
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const activeOrgId = getActiveOrgId();

  useEffect(() => {
    let mounted = true;
    fetchMyOrganizations()
      .then((list) => mounted && setOrgs(list))
      .catch(() => mounted && setError(t("loadError")));
    return () => {
      mounted = false;
    };
  }, [t]);

  const handleSwitch = async (orgId: string) => {
    setSwitching(orgId);
    setError(null);
    try {
      await switchOrganization(orgId);
      // Tải lại hẳn: danh sách dự án, số dư ví ở sidebar đang giữ dữ liệu của org cũ trong bộ nhớ.
      window.location.assign("/home");
    } catch (err) {
      setError(userErrorMessage(err));
      setSwitching(null);
    }
  };

  // Ba trạng thái khác nhau, không gộp: `null` là đang tải, `[]` là chưa thuộc tổ chức nào. Trước đây cả hai
  // ra cùng một danh sách rỗng, nên trong lúc chờ API trang nói sai rằng user không có tổ chức.
  const loadingOrgs = orgs === null;
  const noOrgs = orgs !== null && orgs.length === 0;

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-6">
          {/* Hành động chính của trang nằm cạnh tiêu đề, cùng khuôn với trang Thành viên */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
              <p className="text-body text-on-surface-muted leading-[1.6]">{t("subtitle")}</p>
            </div>
            {noOrgs ? null : (
              <Link href={ONBOARDING_PATH} className={LINK_PRIMARY}>
                <Icon name="plus" size={16} />
                {t("addCta")}
              </Link>
            )}
          </div>

          {error ? (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {error}
            </p>
          ) : null}

          {loadingOrgs ? (
            <PageSkeleton variant="list" label={t("loading")} />
          ) : noOrgs ? (
            <EmptyState
              icon="building"
              title={t("emptyTitle")}
              description={t("emptyBody")}
              action={
                <Link href={ONBOARDING_PATH} className={LINK_PRIMARY}>
                  {t("addCta")}
                </Link>
              }
            />
          ) : (
            // Mảng nền mờ gom cả danh sách, mỗi dòng nổi lên khi rê chuột — không viền, không kẻ ngang.
            // Nhiều tổ chức thì cuộn trong khung thay vì kéo dài trang.
            <div
              role="list"
              className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5 max-h-[60dvh] overflow-y-auto"
            >
              {(orgs ?? []).map((org) => {
                const isCurrent = org.id === activeOrgId;
                return (
                  <div
                    key={org.id}
                    role="listitem"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-container-lowest"
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-3">
                      <span
                        aria-hidden
                        className="shrink-0 grid size-10 place-items-center rounded-full bg-primary-fixed text-primary"
                      >
                        <Icon name="building" size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-heading font-semibold text-on-surface truncate">{org.name}</p>
                        <p className="text-body text-on-surface-muted">{t("roleLine", { role: tRoles(org.role) })}</p>
                      </div>
                    </div>
                    {isCurrent ? (
                      // Trước đây chỉ là chữ màu tím, trông như nút mà bấm không được. Giờ là huy hiệu trạng thái (không
                      // tương tác) + một link thật để vào làm việc ở org này.
                      <div className="flex items-center gap-2">
                        <Badge tone="primary" size="md">
                          {t("current")}
                        </Badge>
                        <Link href="/home" className={LINK_SECONDARY}>
                          {t("goToProjects")}
                        </Link>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={switching === org.id}
                        disabled={switching !== null}
                        onClick={() => void handleSwitch(org.id)}
                      >
                        {t("switch")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
