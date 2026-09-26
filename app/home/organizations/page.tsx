"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { Organization } from "@/types/organization";
import { ONBOARDING_PATH } from "@/components/OrgGuard";

/**
 * UC-10 / BPMN Flow 9.3–9.4 (và 7.13 khi có nhiều org) — chọn tổ chức để làm việc. Dự án, ví và vai trò
 * đều đi theo org đang mở.
 */
export default function OrganizationsPage() {
  const t = useTranslations("app.org.switcher");
  const tRoles = useTranslations("app.org.roles");
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
      setError(err instanceof Error ? err.message : String(err));
      setSwitching(null);
    }
  };

  return (
    <section className="w-full max-w-[720px] mx-auto flex flex-col gap-6 pt-8 pb-12 px-4 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-extrabold text-on-surface tracking-tight">{t("title")}</h1>
        <p className="text-[13.5px] text-on-surface-muted leading-[1.6]">{t("subtitle")}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {(orgs ?? []).map((org) => {
          const isCurrent = org.id === activeOrgId;
          return (
            <li
              key={org.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-outline bg-surface-container-lowest px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-on-surface truncate">{org.name}</p>
                <p className="text-[12.5px] text-on-surface-muted">{t("roleLine", { role: tRoles(org.role) })}</p>
              </div>
              {isCurrent ? (
                // Trước đây chỉ là chữ màu tím, trông như nút mà bấm không được. Giờ là huy hiệu trạng thái (không
                // tương tác) + một link thật để vào làm việc ở org này.
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-[11.5px] font-semibold text-primary">
                    {t("current")}
                  </span>
                  <Link
                    href="/home"
                    className="inline-flex h-8 items-center rounded-control border border-outline bg-surface-container-lowest px-3.5 text-[12.5px] font-bold text-on-surface-medium hover:bg-surface-container-low"
                  >
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
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-outline px-4 py-4">
        <p className="text-[14px] font-semibold text-on-surface">{t("addTitle")}</p>
        <p className="text-[12.5px] text-on-surface-muted">{t("addBody")}</p>
        <Link href={ONBOARDING_PATH} className="self-start text-[13px] font-semibold text-primary hover:underline">
          {t("addCta")}
        </Link>
      </div>
    </section>
  );
}
