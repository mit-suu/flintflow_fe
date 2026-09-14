"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminMetrics,
  fetchAiCost,
  formatNumber,
  formatUsd,
  type AdminMetrics,
  type AiCostReport,
} from "@/lib/api/admin";
import {
  AdminTopBar,
  ErrorBanner,
  LoadingBlock,
  StatCard,
  tableCellClass,
  tableHeadClass,
} from "../_components/AdminPage";

const DAY_MS = 24 * 60 * 60 * 1000;
const toDateInput = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [cost7d, setCost7d] = useState<AiCostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const now = new Date();
        const [nextMetrics, nextCost] = await Promise.all([
          fetchAdminMetrics(),
          fetchAiCost({ from: toDateInput(new Date(now.getTime() - 6 * DAY_MS)), to: toDateInput(now), groupBy: "day" }),
        ]);
        if (cancelled) return;
        setMetrics(nextMetrics);
        setCost7d(nextCost);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải số liệu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AdminTopBar trail={["Số liệu"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Số liệu hệ thống</h1>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {loading ? (
          <LoadingBlock label="Đang tải số liệu…" />
        ) : (
          metrics && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Người dùng" value={formatNumber(metrics.usersTotal)} hint={`+${formatNumber(metrics.usersNew7d)} trong 7 ngày`} />
                <StatCard
                  label="Dự án"
                  value={formatNumber(metrics.projectsTotal)}
                  hint={`${formatNumber(metrics.projectsActive7d)} hoạt động trong 7 ngày`}
                />
                <StatCard label="Baseline" value={formatNumber(metrics.baselinesTotal)} hint="Có từ khi bật S-9 baseline" />
                <StatCard
                  label="Lượt gọi AI hôm nay"
                  value={formatNumber(metrics.aiCallsToday)}
                  hint={`Lỗi 7 ngày: ${(metrics.aiFailRate7d * 100).toFixed(1)}% / ${formatNumber(metrics.aiCalls7d)} lượt`}
                />
              </div>

              {cost7d && (
                <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F1EE]">
                    <h2 className="text-[14px] font-bold text-[#191817]">AI 7 ngày gần nhất</h2>
                    <Link href="/admin/ai-cost" className="text-[12px] font-semibold text-[#4F46E5] hover:underline">
                      Xem chi phí chi tiết
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#FAF9F7]">
                        <tr>
                          <th className={tableHeadClass}>Ngày</th>
                          <th className={`${tableHeadClass} text-right`}>Lượt gọi</th>
                          <th className={`${tableHeadClass} text-right`}>Lỗi</th>
                          <th className={`${tableHeadClass} text-right`}>Token</th>
                          <th className={`${tableHeadClass} text-right`}>Credit đã trừ</th>
                          <th className={`${tableHeadClass} text-right`}>USD ước tính</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F1EE]">
                        {cost7d.rows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-[13px] text-[#A8A49C]">
                              Chưa có lượt gọi AI nào trong 7 ngày
                            </td>
                          </tr>
                        ) : (
                          cost7d.rows.map((row) => (
                            <tr key={row.key}>
                              <td className={tableCellClass}>{row.label}</td>
                              <td className={`${tableCellClass} text-right`}>{formatNumber(row.calls)}</td>
                              <td className={`${tableCellClass} text-right`}>{formatNumber(row.failedCalls)}</td>
                              <td className={`${tableCellClass} text-right`}>
                                {formatNumber(row.promptTokens + row.completionTokens)}
                              </td>
                              <td className={`${tableCellClass} text-right`}>{formatNumber(row.credits)}</td>
                              <td className={`${tableCellClass} text-right`}>{formatUsd(row.estimatedUsd)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}
