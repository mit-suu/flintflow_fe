"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Coins, DollarSign, Sparkles } from "lucide-react";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { fetchAiCost, formatNumber, formatUsd, type AiCostGroupBy, type AiCostReport } from "@/lib/api/admin";
import { Button } from "@/components/shadcn/button";
import { DataTable, DataTableViewOptions } from "@/components/shadcn/data-table";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, ErrorBanner, LoadingBlock, StatCard } from "../_components/AdminPage";
import { aiCostColumns } from "./_components/AiCostColumns";
import { userErrorMessage } from "@/lib/api/error-messages";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;
const toDateInput = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);

const GROUP_LABELS: Record<AiCostGroupBy, string> = {
  day: "Ngày",
  actionType: "Loại action",
  provider: "Provider",
  user: "Người dùng",
};

interface Filters {
  from: string;
  to: string;
  groupBy: AiCostGroupBy;
}

export default function AdminAiCostPage() {
  const [draft, setDraft] = useState<Filters>(() => {
    const now = new Date();
    return { from: toDateInput(new Date(now.getTime() - 29 * DAY_MS)), to: toDateInput(now), groupBy: "day" };
  });
  const [filters, setFilters] = useState<Filters>(draft);
  const [report, setReport] = useState<AiCostReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bộ lọc đã tải xong (kể cả khi lỗi). Khác bộ đang cần ⇒ đang tải. */
  const [loadedFilters, setLoadedFilters] = useState<Filters | null>(null);

  const loading = loadedFilters !== filters;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchAiCost(filters);
        if (cancelled) return;
        setReport(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải chi phí AI"));
      } finally {
        if (!cancelled) setLoadedFilters(filters);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const columns = useMemo(() => aiCostColumns(GROUP_LABELS[report?.groupBy ?? filters.groupBy]), [report, filters]);

  // Cả báo cáo về trong một lần gọi nên phân trang ngay trên dữ liệu đang có — không phải hỏi BE từng trang.
  const table = useReactTable({
    data: report?.rows ?? [],
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting: false,
  });

  const apply = (next: Filters) => setFilters(next);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply(draft);
  };

  const changeGroupBy = (groupBy: AiCostGroupBy) => {
    const next = { ...draft, groupBy };
    setDraft(next);
    apply(next);
  };

  const totals = report?.totals;

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader
          title="Chi phí AI"
          description="Token từ nhật ký gọi AI, credit từ giao dịch đã trừ (không tính lượt đã hoàn)."
        />

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {loading && !report ? (
          <LoadingBlock label="Đang tổng hợp chi phí…" variant="cards" />
        ) : (
          report && (
            <>
              {/* Tổng của cả khoảng thời gian lên thẻ, giống trang Số liệu — thay cho hàng tổng dưới bảng,
                  vốn bị đẩy xuống dưới cùng và không ai cuộn tới. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Lượt gọi" icon={Sparkles} value={formatNumber(totals?.calls ?? 0)} />
                <StatCard label="Lượt lỗi" icon={CircleAlert} value={formatNumber(totals?.failedCalls ?? 0)} />
                <StatCard label="Credit đã trừ" icon={Coins} value={formatNumber(totals?.credits ?? 0)} />
                <StatCard
                  label="USD ước tính"
                  icon={DollarSign}
                  value={formatUsd(totals?.estimatedUsd ?? 0)}
                  hint={report.pricingNote}
                />
              </div>

              <DataTable
                table={table}
                columns={columns}
                emptyMessage="Không có dữ liệu trong khoảng thời gian này"
                className={loading ? "opacity-60 transition-opacity" : undefined}
                toolbar={
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cost-from" className="text-muted-foreground text-caption">
                          Từ ngày
                        </Label>
                        <Input
                          id="cost-from"
                          type="date"
                          value={draft.from}
                          max={draft.to}
                          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                          className="h-8 w-[150px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cost-to" className="text-muted-foreground text-caption">
                          Đến ngày
                        </Label>
                        <Input
                          id="cost-to"
                          type="date"
                          value={draft.to}
                          min={draft.from}
                          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                          className="h-8 w-[150px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cost-group" className="text-muted-foreground text-caption">
                          Gom theo
                        </Label>
                        <Select value={filters.groupBy} onValueChange={(v) => changeGroupBy(v as AiCostGroupBy)}>
                          <SelectTrigger id="cost-group" className="h-8 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(GROUP_LABELS) as AiCostGroupBy[]).map((g) => (
                              <SelectItem key={g} value={g}>
                                {GROUP_LABELS[g]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" variant="outline" size="sm" className="h-8">
                        Xem
                      </Button>
                    </form>
                    <DataTableViewOptions table={table} />
                  </div>
                }
              />
            </>
          )
        )}
      </AdminMain>
    </>
  );
}
