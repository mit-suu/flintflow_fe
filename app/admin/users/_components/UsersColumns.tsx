"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/shadcn/badge";
import { formatDateTime, formatNumber, type AdminUser } from "@/lib/api/admin";
import type { Locale } from "@/lib/i18n";
import type { AdminT } from "../../_components/admin-nav";

export const userRoleOptions = (t: AdminT) => [
  { label: t("common.userRoles.admin"), value: "admin" },
  { label: t("common.userRoles.user"), value: "user" },
];

export const userStatusOptions = (t: AdminT) => [
  { label: t("users.statusActive"), value: "true" },
  { label: t("common.suspended"), value: "false" },
];

export function usersColumns(t: AdminT, locale: Locale): ColumnDef<AdminUser, unknown>[] {
  return [
    {
      id: "email",
      accessorKey: "email",
      header: t("users.email"),
      enableHiding: false,
      meta: { label: t("users.email") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/admin/users/${row.original._id}`}
            className="text-accent-foreground font-semibold hover:underline"
          >
            {row.original.email}
          </Link>
          {row.original.name && <div className="text-muted-foreground text-caption">{row.original.name}</div>}
        </div>
      ),
    },
    {
      id: "role",
      accessorKey: "role",
      header: t("common.role"),
      meta: { label: t("common.role") },
      cell: ({ row }) => {
        const isAdmin = row.original.role === "admin";
        // Badge nền trắng, chỉ viền và chữ đổi màu: cả cột toàn ô tô nền thì bảng rối, mà vai trò chỉ là
        // thông tin phụ — quản trị viên mới cần nổi lên.
        return (
          <Badge variant="outline" className={isAdmin ? "border-primary/40 text-primary" : "text-muted-foreground"}>
            {isAdmin ? t("common.userRoles.admin") : t("common.userRoles.user")}
          </Badge>
        );
      },
    },
    {
      id: "isActive",
      accessorKey: "isActive",
      header: t("common.status"),
      meta: { label: t("common.status") },
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="text-success font-semibold">{t("common.active")}</span>
        ) : (
          <span className="text-destructive font-semibold">{t("common.suspended")}</span>
        ),
    },
    {
      id: "organizationsCount",
      accessorKey: "organizationsCount",
      header: t("users.organizations"),
      meta: { label: t("users.organizations"), className: "text-end" },
      cell: ({ row }) => formatNumber(row.original.organizationsCount, locale),
    },
    {
      id: "projectsCount",
      accessorKey: "projectsCount",
      header: t("common.projects"),
      meta: { label: t("common.projects"), className: "text-end" },
      cell: ({ row }) => formatNumber(row.original.projectsCount, locale),
    },
    {
      id: "lastLoginAt",
      accessorKey: "lastLoginAt",
      header: t("common.lastLogin"),
      meta: { label: t("common.lastLogin") },
      cell: ({ row }) => formatDateTime(row.original.lastLoginAt, locale),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("common.createdAt"),
      meta: { label: t("common.createdAt") },
      cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
    },
  ];
}
