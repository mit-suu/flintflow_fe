"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck, FolderKanban, Sparkles, Users } from "lucide-react";
import {
  fetchAdminMetrics,
  fetchAiCost,
  formatNumber,
  type AdminMetrics,
  type AiCostReport,
} from "@/lib/api/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import AdminHeader from "../_components/AdminHeader";
import AiCallsChart from "./_components/AiCallsChart";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner, LoadingBlock, StatCard } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

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
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải số liệu"));
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
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader title="Số liệu hệ thống" description="Tình hình chung của FlintFlow trong 7 ngày gần nhất." />

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        <AdminScroll>
          {loading ? (
            <LoadingBlock label="Đang tải số liệu…" variant="cards" />
          ) : (
            metrics && (
              <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Người dùng"
                  icon={Users}
                  href="/admin/users"
                  value={formatNumber(metrics.usersTotal)}
                  hint={`+${formatNumber(metrics.usersNew7d)} trong 7 ngày`}
                />
                <StatCard
                  label="Dự án"
                  icon={FolderKanban}
                  value={formatNumber(metrics.projectsTotal)}
                  hint={`${formatNumber(metrics.projectsActive7d)} hoạt động trong 7 ngày`}
                />
                <StatCard
                  label="Baseline"
                  icon={FileCheck}
                  value={formatNumber(metrics.baselinesTotal)}
                  hint="Có từ khi bật S-9 baseline"
                />
                <StatCard
                  label="Lượt gọi AI hôm nay"
                  icon={Sparkles}
                  href="/admin/ai-cost"
                  value={formatNumber(metrics.aiCallsToday)}
                  hint={`Lỗi 7 ngày: ${(metrics.aiFailRate7d * 100).toFixed(1)}% / ${formatNumber(metrics.aiCalls7d)} lượt`}
                />
              </div>

              {cost7d && (
                <Card>
                  <CardHeader>
                    <CardTitle>Lượt gọi AI theo ngày</CardTitle>
                    <CardDescription>
                      Cột tím là tổng lượt gọi, cột đỏ là lượt lỗi. Số tiền và token xem ở{" "}
                      <Link href="/admin/ai-cost" className="font-medium underline underline-offset-4">
                        Chi phí AI
                      </Link>
                      .
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cost7d.rows.length === 0 ? (
                      <p className="text-muted-foreground py-12 text-center text-body">
                        Chưa có lượt gọi AI nào trong 7 ngày
                      </p>
                    ) : (
                      <AiCallsChart rows={cost7d.rows} />
                    )}
                  </CardContent>
                </Card>
              )}
              </>
            )
          )}
        </AdminScroll>
      </AdminMain>
    </>
  );
}
