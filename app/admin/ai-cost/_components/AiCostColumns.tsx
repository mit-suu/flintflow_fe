"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatNumber, formatUsd, type AiCostRow } from "@/lib/api/admin";
import type { Locale } from "@/lib/i18n";
import type { AdminT } from "../../_components/admin-nav";

/** Cột đầu đổi tên theo chiều đang gom nhóm (ngày / loại action / provider / người dùng). */
export function aiCostColumns(groupLabel: string, t: AdminT, locale: Locale): ColumnDef<AiCostRow, unknown>[] {
  const num = (value: number) => formatNumber(value, locale);
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
      header: t("common.calls"),
      meta: { label: t("common.calls"), className: "text-end tabular-nums" },
      cell: ({ row }) => num(row.original.calls),
    },
    {
      id: "failedCalls",
      accessorKey: "failedCalls",
      header: t("aiCost.columns.failed"),
      meta: { label: t("aiCost.columns.failed"), className: "text-end tabular-nums" },
      cell: ({ row }) => num(row.original.failedCalls),
    },
    {
      id: "promptTokens",
      accessorKey: "promptTokens",
      header: t("aiCost.columns.promptTokens"),
      meta: { label: t("aiCost.columns.promptTokens"), className: "text-end tabular-nums" },
      cell: ({ row }) => num(row.original.promptTokens),
    },
    {
      id: "completionTokens",
      accessorKey: "completionTokens",
      header: t("aiCost.columns.completionTokens"),
      meta: { label: t("aiCost.columns.completionTokens"), className: "text-end tabular-nums" },
      cell: ({ row }) => num(row.original.completionTokens),
    },
    {
      id: "credits",
      accessorKey: "credits",
      header: t("common.creditsDeducted"),
      meta: { label: t("common.creditsDeducted"), className: "text-end tabular-nums" },
      cell: ({ row }) => num(row.original.credits),
    },
    {
      id: "estimatedUsd",
      accessorKey: "estimatedUsd",
      header: t("common.estimatedUsd"),
      meta: { label: t("common.estimatedUsd"), className: "text-end tabular-nums" },
      cell: ({ row }) => formatUsd(row.original.estimatedUsd),
    },
  ];
}
