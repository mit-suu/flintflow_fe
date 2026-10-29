"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import { ONBOARDING_PATH } from "@/components/OrgGuard";
import { fetchMyOrganizations, onOrganizationChanged, switchOrganization } from "@/lib/api/orgs";
import type { ActiveOrganization } from "@/lib/hooks/use-active-org";
import type { Organization } from "@/types/organization";
import { SIDEBAR_ROW, SIDEBAR_ROW_IDLE, SidebarTooltip, sidebarRowLayout } from "./SidebarNavItem";

/**
 * Bộ chọn tổ chức ở đầu nhóm "Tổ chức" của thanh bên. Đổi tổ chức là đổi NGỮ CẢNH (dự án, ví credit và vai trò
 * đều đi theo tổ chức đang mở), không phải điều hướng tới một trang — nên nó là một control ngay tại chỗ đang
 * hiện tên tổ chức, chứ không còn là một mục nav riêng.
 */
export default function OrgSwitcher({ activeOrg, collapsed }: { activeOrg: ActiveOrganization; collapsed: boolean }) {
  const t = useTranslations("app.shell");
  const tSwitcher = useTranslations("app.org.switcher");
  const tRoles = useTranslations("app.org.roles");
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Tổ chức đổi tên ⇒ bỏ danh sách đã tải để lần mở menu sau đọc lại tên mới
  useEffect(
    () =>
      onOrganizationChanged(() => {
        setOrgs(null);
        setFailed(false);
      }),
    []
  );

  // Chỉ tải danh sách khi người dùng thật sự mở menu: thanh bên nằm trên mọi trang `/home`, tải sẵn thì mỗi lần
  // đổi trang lại tốn một request cho thứ hiếm khi dùng.
  const loadOrgs = () => {
    if (orgs !== null || failed) return;
    fetchMyOrganizations()
      .then(setOrgs)
      .catch(() => setFailed(true));
  };

  const handleSwitch = (orgId: string) => {
    if (orgId === activeOrg.id || switching) return;
    setSwitching(true);
    switchOrganization(orgId)
      // Tải lại hẳn, không `router.push`: `ProjectsProvider` ở layout đang giữ dự án và số dư của tổ chức cũ
      // trong bộ nhớ, điều hướng phía client không dựng lại layout nên nó sẽ hiện dữ liệu sai tổ chức.
      .then(() => window.location.assign("/home"))
      .catch(() => {
        setFailed(true);
        setSwitching(false);
      });
  };

  const orgItems: DropdownMenuItem[] =
    orgs === null
      ? [{ label: failed ? tSwitcher("loadError") : tSwitcher("loading"), onSelect: () => undefined, disabled: true }]
      : orgs.map((org) => ({
          label: org.name,
          icon: org.id === activeOrg.id ? "check" : undefined,
          disabled: switching,
          onSelect: () => handleSwitch(org.id),
          trailing: <span className="text-caption text-on-surface-muted">{tRoles(org.role)}</span>,
        }));

  const items: DropdownMenuItem[] = [
    ...orgItems,
    { label: tSwitcher("addCta"), icon: "plus", onSelect: () => router.push(ONBOARDING_PATH) },
  ];

  return (
    <DropdownMenu
      placement="right-start"
      items={items}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          onClick={(e) => {
            loadOrgs();
            props.onClick(e);
          }}
          data-testid="active-org-name"
          title={collapsed ? undefined : activeOrg.name}
          aria-label={t("orgSwitcher", { org: activeOrg.name })}
          className={`${SIDEBAR_ROW} ${sidebarRowLayout(collapsed)} ${SIDEBAR_ROW_IDLE} w-full cursor-pointer`}
        >
          <Icon name="building" size={19} />
          {collapsed ? (
            <SidebarTooltip label={t("orgSwitcher", { org: activeOrg.name })} />
          ) : (
            <>
              {/* `-ml-1 -mr-0.5`: caret ăn vào khoảng `gap-3` của dòng, để tên tổ chức có đúng bề ngang như nhãn
                  của các mục nav bên dưới thay vì bị cắt sớm hơn chúng. */}
              <span className="flex-1 truncate text-left font-semibold text-on-surface">{activeOrg.name}</span>
              <Icon name="caret-up-down" size={15} className="-ml-1 -mr-0.5 text-on-surface-muted" />
            </>
          )}
        </button>
      )}
    />
  );
}
