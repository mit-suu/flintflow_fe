"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatNumber, formatUsd, type AiCostRow } from "@/lib/api/admin";

/** Cột đầu đổi tên theo chiều đang gom nhóm (ngày / loại action / provider / người dùng). */
export function aiCostColumns(groupLabel: string): ColumnDef<AiCostRow, unknown>[] {
  return [
    {
      id: "label",
      accessorKey: "label",
      header: groupLabel,
      enableHiding: false,
      meta: { label: groupLabel },
      cell: ({ row }) => <span className="font-semibold">{row.original.label}</span>,
    },
    {
      id: "calls",
      accessorKey: "calls",
      header: "Lượt gọi",
      meta: { label: "Lượt gọi", className: "text-end tabular-nums" },
      cell: ({ row }) => formatNumber(row.original.calls),
    },
    {
      id: "failedCalls",
      accessorKey: "failedCalls",
      header: "Lỗi",
      meta: { label: "Lỗi", className: "text-end tabular-nums" },
      cell: ({ row }) => formatNumber(row.original.failedCalls),
    },
    {
      id: "promptTokens",
      accessorKey: "promptTokens",
      header: "Token vào",
      meta: { label: "Token vào", className: "text-end tabular-nums" },
      cell: ({ row }) => formatNumber(row.original.promptTokens),
    },
    {
      id: "completionTokens",
      accessorKey: "completionTokens",
      header: "Token ra",
      meta: { label: "Token ra", className: "text-end tabular-nums" },
      cell: ({ row }) => formatNumber(row.original.completionTokens),
    },
    {
      id: "credits",
      accessorKey: "credits",
      header: "Credit đã trừ",
      meta: { label: "Credit đã trừ", className: "text-end tabular-nums" },
      cell: ({ row }) => formatNumber(row.original.credits),
    },
    {
      id: "estimatedUsd",
      accessorKey: "estimatedUsd",
      header: "USD ước tính",
      meta: { label: "USD ước tính", className: "text-end tabular-nums" },
      cell: ({ row }) => formatUsd(row.original.estimatedUsd),
    },
  ];
}
