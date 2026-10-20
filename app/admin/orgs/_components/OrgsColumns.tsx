"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { formatDateTime, formatNumber, type AdminOrg } from "@/lib/api/admin";

export const ORG_PLAN_OPTIONS = [
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
];

/** Cột của bảng tổ chức; `onAdjust` mở hộp thoại điều chỉnh credit của đúng tổ chức ở hàng đó. */
export function orgsColumns(onAdjust: (org: AdminOrg) => void): ColumnDef<AdminOrg, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: "Tổ chức",
      enableHiding: false,
      meta: { label: "Tổ chức" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold">{row.original.name}</div>
          <div className="text-muted-foreground text-caption">
            {row.original.owner?.email ?? "Người tạo đã xoá"}
          </div>
        </div>
      ),
    },
    {
      id: "plan",
      accessorKey: "plan",
      header: "Gói",
      meta: { label: "Gói" },
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
      header: "Số dư ví",
      meta: { label: "Số dư ví", className: "text-end" },
      cell: ({ row }) => {
        const wallet = row.original.wallet;
        if (!wallet) return <span className="text-muted-foreground">Chưa có ví</span>;
        return (
          <>
            <div className="font-semibold">{formatNumber(wallet.balance)}</div>
            {wallet.reserved > 0 && (
              <div className="text-muted-foreground text-caption">đang giữ {formatNumber(wallet.reserved)}</div>
            )}
          </>
        );
      },
    },
    {
      id: "membersCount",
      accessorKey: "membersCount",
      header: "Thành viên",
      meta: { label: "Thành viên", className: "text-end" },
      cell: ({ row }) => formatNumber(row.original.membersCount),
    },
    {
      id: "projectsCount",
      accessorKey: "projectsCount",
      header: "Dự án",
      meta: { label: "Dự án", className: "text-end" },
      cell: ({ row }) => formatNumber(row.original.projectsCount),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Ngày tạo",
      meta: { label: "Ngày tạo" },
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Thao tác</span>,
      enableHiding: false,
      meta: { className: "text-end" },
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdjust(row.original)}
          aria-label={`Điều chỉnh credit của ${row.original.name}`}
          className="text-accent-foreground whitespace-nowrap"
        >
          Điều chỉnh credit
        </Button>
      ),
    },
  ];
}
