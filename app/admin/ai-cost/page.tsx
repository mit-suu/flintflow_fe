"use client";

import { useEffect, useState } from "react";
import {
  fetchAiCost,
  formatNumber,
  formatUsd,
  type AiCostGroupBy,
  type AiCostReport,
} from "@/lib/api/admin";
import {
  AdminTopBar,
  ErrorBanner,
  LoadingBlock,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from "../_components/AdminPage";

const DAY_MS = 24 * 60 * 60 * 1000;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchAiCost(filters);
        if (cancelled) return;
        setReport(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải chi phí AI");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const apply = (next: Filters) => {
    setLoading(true);
    setFilters(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply(draft);
  };

  const changeGroupBy = (groupBy: AiCostGroupBy) => {
    const next = { ...draft, groupBy };
    setDraft(next);
    apply(next);
  };

  return (
    <>
      <AdminTopBar trail={["Chi phí AI"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Chi phí AI</h1>
            <p className="text-[12.5px] text-[#8A867E] mt-1">
              Token từ nhật ký gọi AI, credit từ giao dịch đã trừ (không tính lượt đã hoàn).
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#8A867E]">
              Từ ngày
              <input
                type="date"
                value={draft.from}
                max={draft.to}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#8A867E]">
              Đến ngày
              <input
                type="date"
                value={draft.to}
                min={draft.from}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="h-9 px-4 rounded-[10px] bg-[#191817] text-white text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
            >
              Xem
            </button>
          </form>
        </div>

        <div className="flex bg-white border border-[#E4E1DC] rounded-full p-0.5 self-start">
          {(Object.keys(GROUP_LABELS) as AiCostGroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => changeGroupBy(g)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                filters.groupBy === g ? "bg-[#191817] text-white" : "text-[#6B6862] hover:text-[#191817]"
              }`}
            >
              Theo {GROUP_LABELS[g].toLowerCase()}
            </button>
          ))}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
          {loading ? (
            <LoadingBlock label="Đang tổng hợp chi phí…" bare />
          ) : (
            report && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#FAF9F7]">
                    <tr>
                      <th className={tableHeadClass}>{GROUP_LABELS[report.groupBy]}</th>
                      <th className={`${tableHeadClass} text-right`}>Lượt gọi</th>
                      <th className={`${tableHeadClass} text-right`}>Lỗi</th>
                      <th className={`${tableHeadClass} text-right`}>Token vào</th>
                      <th className={`${tableHeadClass} text-right`}>Token ra</th>
                      <th className={`${tableHeadClass} text-right`}>Credit đã trừ</th>
                      <th className={`${tableHeadClass} text-right`}>USD ước tính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F1EE]">
                    {report.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[13px] text-[#A8A49C]">
                          Không có dữ liệu trong khoảng thời gian này
                        </td>
                      </tr>
                    ) : (
                      report.rows.map((row) => (
                        <tr key={row.key} className="hover:bg-[#FAF9F7]">
                          <td className={`${tableCellClass} font-semibold`}>{row.label}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.calls)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.failedCalls)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.promptTokens)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.completionTokens)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.credits)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatUsd(row.estimatedUsd)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {report.rows.length > 0 && (
                    <tfoot className="bg-[#FAF9F7] border-t border-[#ECEAE5]">
                      <tr>
                        <td className={`${tableCellClass} font-extrabold`}>Tổng</td>
                        <td className={`${tableCellClass} text-right font-bold`}>{formatNumber(report.totals.calls)}</td>
                        <td className={`${tableCellClass} text-right font-bold`}>{formatNumber(report.totals.failedCalls)}</td>
                        <td className={`${tableCellClass} text-right font-bold`}>{formatNumber(report.totals.promptTokens)}</td>
                        <td className={`${tableCellClass} text-right font-bold`}>
                          {formatNumber(report.totals.completionTokens)}
                        </td>
                        <td className={`${tableCellClass} text-right font-bold`}>{formatNumber(report.totals.credits)}</td>
                        <td className={`${tableCellClass} text-right font-bold`}>{formatUsd(report.totals.estimatedUsd)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          )}
        </div>

        {report && <p className="text-[11px] text-[#A8A49C]">* {report.pricingNote}.</p>}
      </div>
    </>
  );
}
