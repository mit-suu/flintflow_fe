"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/shadcn/badge";
import { formatDateTime, formatNumber, type AdminUser } from "@/lib/api/admin";

export const USER_ROLE_OPTIONS = [
  { label: "Quản trị viên", value: "admin" },
  { label: "Người dùng", value: "user" },
];

export const USER_STATUS_OPTIONS = [
  { label: "Đang hoạt động", value: "true" },
  { label: "Đã khoá", value: "false" },
];

export const usersColumns: ColumnDef<AdminUser, unknown>[] = [
  {
    id: "email",
    accessorKey: "email",
    header: "Email",
    enableHiding: false,
    meta: { label: "Email" },
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
    header: "Vai trò",
    meta: { label: "Vai trò" },
    cell: ({ row }) => {
      const isAdmin = row.original.role === "admin";
      // Badge nền trắng, chỉ viền và chữ đổi màu: cả cột toàn ô tô nền thì bảng rối, mà vai trò chỉ là
      // thông tin phụ — quản trị viên mới cần nổi lên.
      return (
        <Badge variant="outline" className={isAdmin ? "border-primary/40 text-primary" : "text-muted-foreground"}>
          {isAdmin ? "Quản trị viên" : "Người dùng"}
        </Badge>
      );
    },
  },
  {
    id: "isActive",
    accessorKey: "isActive",
    header: "Trạng thái",
    meta: { label: "Trạng thái" },
    cell: ({ row }) =>
      row.original.isActive ? (
        <span className="text-success font-semibold">Hoạt động</span>
      ) : (
        <span className="text-destructive font-semibold">Đã khoá</span>
      ),
  },
  {
    id: "organizationsCount",
    accessorKey: "organizationsCount",
    header: "Tổ chức",
    meta: { label: "Tổ chức", className: "text-end" },
    cell: ({ row }) => formatNumber(row.original.organizationsCount),
  },
  {
    id: "projectsCount",
    accessorKey: "projectsCount",
    header: "Dự án",
    meta: { label: "Dự án", className: "text-end" },
    cell: ({ row }) => formatNumber(row.original.projectsCount),
  },
  {
    id: "lastLoginAt",
    accessorKey: "lastLoginAt",
    header: "Đăng nhập gần nhất",
    meta: { label: "Đăng nhập gần nhất" },
    cell: ({ row }) => formatDateTime(row.original.lastLoginAt),
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: "Ngày tạo",
    meta: { label: "Ngày tạo" },
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];
