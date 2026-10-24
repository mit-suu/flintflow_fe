"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { formatDateTime, formatNumber, type AdminOrg } from "@/lib/api/admin";
import type { Locale } from "@/lib/i18n";
import type { AdminT } from "../../_components/admin-nav";

/** Tên gói là tên sản phẩm — giống nhau ở mọi ngôn ngữ. */
export const ORG_PLAN_OPTIONS = [
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
];

/** Cột của bảng tổ chức; `onAdjust` mở hộp thoại điều chỉnh credit của đúng tổ chức ở hàng đó. */
export function orgsColumns(onAdjust: (org: AdminOrg) => void, t: AdminT, locale: Locale): ColumnDef<AdminOrg, unknown>[] {
  const num = (value: number) => formatNumber(value, locale);
  return [
    {
      id: "name",
      accessorKey: "name",
      header: t("common.organization"),
      enableHiding: false,
      meta: { label: t("common.organization") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold">{row.original.name}</div>
          <div className="text-muted-foreground text-caption">
            {row.original.owner?.email ?? t("orgs.ownerDeleted")}
          </div>
        </div>
      ),
    },
    {
      id: "plan",
      accessorKey: "plan",
      header: t("orgs.plan"),
      meta: { label: t("orgs.plan") },
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={row.original.plan === "pro" ? "border-primary/40 text-primary" : "text-muted-foreground"}
        >
          {row.original.planLabel}
        </Badge>
      ),
    },
    {
      id: "wallet",
      header: t("common.walletBalance"),
      meta: { label: t("common.walletBalance"), className: "text-end" },
      cell: ({ row }) => {
        const wallet = row.original.wallet;
        if (!wallet) return <span className="text-muted-foreground">{t("common.noWallet")}</span>;
        return (
          <>
            <div className="font-semibold">{num(wallet.balance)}</div>
            {wallet.reserved > 0 && (
              <div className="text-muted-foreground text-caption">{t("orgs.reserved", { amount: num(wallet.reserved) })}</div>
            )}
          </>
        );
      },
    },
    {
      id: "membersCount",
      accessorKey: "membersCount",
      header: t("orgs.members"),
      meta: { label: t("orgs.members"), className: "text-end" },
      cell: ({ row }) => num(row.original.membersCount),
    },
    {
      id: "projectsCount",
      accessorKey: "projectsCount",
      header: t("common.projects"),
      meta: { label: t("common.projects"), className: "text-end" },
      cell: ({ row }) => num(row.original.projectsCount),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("common.createdAt"),
      meta: { label: t("common.createdAt") },
      cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("orgs.actions")}</span>,
      enableHiding: false,
      meta: { className: "text-end" },
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdjust(row.original)}
          aria-label={t("orgs.adjustFor", { name: row.original.name })}
          className="text-accent-foreground whitespace-nowrap"
        >
          {t("orgs.adjust")}
        </Button>
      ),
    },
  ];
}
