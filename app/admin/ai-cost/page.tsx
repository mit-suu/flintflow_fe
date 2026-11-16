"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleAlert, Coins, DollarSign, Sparkles } from "lucide-react";
import { fetchAiCostPage, formatNumber, formatUsd, type AiCostGroupBy, type AiCostReport, type AiCostRow } from "@/lib/api/admin";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { PagedDataList } from "@/components/ui";
import { usePagedList } from "@/lib/hooks/use-paged-list";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner, LoadingBlock, StatCard } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;
const toDateInput = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);

/** Thứ tự các chiều gom nhóm trong ô chọn; nhãn ở `admin.aiCost.groups`. */
const GROUP_BYS: AiCostGroupBy[] = ["day", "actionType", "provider", "user"];

/** Cột từ `lg`: nhóm | lượt gọi | lỗi | token vào | token ra | credit | USD. Dưới `lg` các số xếp thành hàng có nhãn. */
const ROW_GRID = "lg:grid lg:grid-cols-[minmax(0,1.4fr)_repeat(6,minmax(0,1fr))] lg:items-center lg:gap-3";

interface Filters {
  from: string;
  to: string;
  groupBy: AiCostGroupBy;
}

/**
 * Chi phí AI theo khoảng ngày, gom theo một chiều. Thanh số trang (FLF-404): dòng phân trang ở BE; thẻ tổng đọc `totals`
 * của báo cáo — BE tính trên toàn bộ nhóm, không theo trang.
 */
export default function AdminAiCostPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [draft, setDraft] = useState<Filters>(() => {
    const now = new Date();
    return { from: toDateInput(new Date(now.getTime() - 29 * DAY_MS)), to: toDateInput(now), groupBy: "day" };
  });
  const [filters, setFilters] = useState<Filters>(draft);
  /** Báo cáo của lần tải gần nhất — lấy `totals`, `pricingNote`, `groupBy` cho thẻ tổng và cột đầu. */
  const [report, setReport] = useState<AiCostReport | null>(null);

  const list = usePagedList<AiCostRow>({
    key: `${filters.from}|${filters.to}|${filters.groupBy}`,
    fetchPage: async (page) => {
      const res = await fetchAiCostPage(filters, page, PAGE_SIZE);
      setReport(res.report);
      return res;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(draft);
  };

  const changeGroupBy = (groupBy: AiCostGroupBy) => {
    const next = { ...draft, groupBy };
    setDraft(next);
    setFilters(next);
  };

  const num = (value: number) => formatNumber(value, locale);
  const totals = report?.totals;
  const groupLabel = t(`aiCost.groups.${report?.groupBy ?? filters.groupBy}`);
  /** Các cột số: nhãn (tiêu đề cột, và nhãn đứng trước số dưới `lg`) + cách đọc giá trị của dòng. */
  const metricCols: { label: string; value: (row: AiCostRow) => string }[] = [
    { label: t("common.calls"), value: (row) => num(row.calls) },
    { label: t("aiCost.columns.failed"), value: (row) => num(row.failedCalls) },
    { label: t("aiCost.columns.promptTokens"), value: (row) => num(row.promptTokens) },
    { label: t("aiCost.columns.completionTokens"), value: (row) => num(row.completionTokens) },
    { label: t("common.creditsDeducted"), value: (row) => num(row.credits) },
    { label: t("common.estimatedUsd"), value: (row) => formatUsd(row.estimatedUsd) },
  ];

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader title={t("aiCost.title")} description={t("aiCost.description")} />

        {/* Bộ lọc nằm ngoài vùng cuộn nên luôn thấy được */}
        <form onSubmit={handleSubmit} className="flex shrink-0 flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="cost-from" className="text-muted-foreground text-caption">
              {t("aiCost.from")}
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
              {t("aiCost.to")}
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
              {t("aiCost.groupBy")}
            </Label>
            <Select value={filters.groupBy} onValueChange={(v) => changeGroupBy(v as AiCostGroupBy)}>
              <SelectTrigger id="cost-group" className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BYS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {t(`aiCost.groups.${g}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-8">
            {t("aiCost.view")}
          </Button>
        </form>

        {list.error ? <ErrorBanner message={userErrorMessage(list.error, t("aiCost.loadFailed"))} /> : null}

        <AdminScroll>
          {report === null ? (
            !list.error && <LoadingBlock label={t("aiCost.loading")} variant="cards" />
          ) : (
            // Tổng của cả khoảng thời gian lên thẻ, giống trang Số liệu — thay cho hàng tổng dưới bảng
            <div className={`grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity ${list.stale ? "opacity-60" : ""}`}>
              <StatCard label={t("common.calls")} icon={Sparkles} value={formatNumber(totals?.calls ?? 0, locale)} />
              <StatCard label={t("aiCost.failedCalls")} icon={CircleAlert} value={formatNumber(totals?.failedCalls ?? 0, locale)} />
              <StatCard label={t("common.creditsDeducted")} icon={Coins} value={formatNumber(totals?.credits ?? 0, locale)} />
              <StatCard label={t("common.estimatedUsd")} icon={DollarSign} value={formatUsd(totals?.estimatedUsd ?? 0)} hint={report.pricingNote} />
            </div>
          )}

          <PagedDataList
            list={list}
            getKey={(row) => row.key}
            loadingLabel={t("aiCost.loading")}
            rowClassName={`flex flex-col gap-1 text-body ${ROW_GRID}`}
            empty={
              !list.error && (
                <p className="bg-surface-container-low text-muted-foreground rounded-card px-4 py-16 text-center text-body">{t("aiCost.empty")}</p>
              )
            }
            // Tiêu đề cột chỉ có khi các ô thẳng cột (từ `lg`); cột đầu đổi tên theo chiều đang gom
            header={
              <div aria-hidden className={`hidden ${ROW_GRID} text-muted-foreground px-3 pt-1.5 pb-2 text-caption font-semibold`}>
                <span>{groupLabel}</span>
                {metricCols.map((col) => (
                  <span key={col.label} className="text-right">
                    {col.label}
                  </span>
                ))}
              </div>
            }
            renderItem={(row) => (
              <>
                <span className="min-w-0 truncate font-semibold" title={row.label}>
                  {row.label}
                </span>
                <div className="contents max-lg:flex max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-0.5 max-lg:text-caption">
                  {metricCols.map((col) => (
                    <span key={col.label} className="text-muted-foreground tabular-nums lg:text-right lg:text-foreground">
                      <span className="lg:hidden">{col.label}: </span>
                      {col.value(row)}
                    </span>
                  ))}
                </div>
              </>
            )}
          />
        </AdminScroll>
      </AdminMain>
    </>
  );
}
