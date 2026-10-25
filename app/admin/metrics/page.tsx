"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("admin.metrics");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [cost7d, setCost7d] = useState<AiCostReport | null>(null);
  const [loading, setLoading] = useState(true);
  /** Lỗi tải gần nhất: giữ nguyên lỗi, dịch lúc render — đổi ngôn ngữ không phải tải lại. */
  const [error, setError] = useState<{ cause: unknown } | null>(null);

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
        if (!cancelled) setError({ cause: err });
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
        <AdminPageHeader title={t("title")} description={t("description")} />

        {error && <ErrorBanner message={userErrorMessage(error.cause, t("loadFailed"))} onClose={() => setError(null)} />}

        <AdminScroll>
          {loading ? (
            <LoadingBlock label={t("loading")} variant="cards" />
          ) : (
            metrics && (
              <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label={t("users")}
                  icon={Users}
                  href="/admin/users"
                  value={num(metrics.usersTotal)}
                  hint={t("usersHint", { count: num(metrics.usersNew7d) })}
                />
                <StatCard
                  label={t("projects")}
                  icon={FolderKanban}
                  value={num(metrics.projectsTotal)}
                  hint={t("projectsHint", { count: num(metrics.projectsActive7d) })}
                />
                <StatCard
                  label={t("baseline")}
                  icon={FileCheck}
                  value={num(metrics.baselinesTotal)}
                  hint={t("baselineHint")}
                />
                <StatCard
                  label={t("aiCallsToday")}
                  icon={Sparkles}
                  href="/admin/ai-cost"
                  value={num(metrics.aiCallsToday)}
                  hint={t("aiCallsHint", { rate: (metrics.aiFailRate7d * 100).toFixed(1), calls: num(metrics.aiCalls7d) })}
                />
              </div>

              {cost7d && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("chartTitle")}</CardTitle>
                    <CardDescription>
                      {t.rich("chartDescription", {
                        link: (chunks) => (
                          <Link href="/admin/ai-cost" className="font-medium underline underline-offset-4">
                            {chunks}
                          </Link>
                        ),
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cost7d.rows.length === 0 ? (
                      <p className="text-muted-foreground py-12 text-center text-body">
                        {t("chartEmpty")}
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
