"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, IconButton, PageSkeleton } from "@/components/ui";
import {
  createCheckout,
  fetchBalance,
  fetchPackages,
  fetchTransactions,
  formatVnd,
  upgradePlan,
  type BalanceResponse,
  type CreditPackage,
  type CreditTransaction,
  type PlanDefinition,
  type PlanId,
} from "@/lib/api/billing";
import { emitNotificationsChanged } from "@/lib/api/notifications";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useActiveOrganization } from "@/lib/hooks/use-active-org";

const signedAmount = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || tx.type === "monthly_reset") return `+${tx.amount}`;
  if (tx.type === "deduct") return `−${tx.amount}`;
  return String(tx.amount);
};

/** Chỉ đổi màu con số, không đổi hình thẻ: khả dụng là con số người dùng theo dõi, số khác chỉ là tham chiếu. */
type StatTone = "primary" | "error" | "muted" | "plain";

const STAT_TONE: Record<StatTone, string> = {
  primary: "text-primary",
  error: "text-error",
  muted: "text-on-surface-muted",
  plain: "text-on-surface",
};

/** Thẻ số của trang ví: nhãn nhỏ in hoa, số lớn, dòng đơn vị. */
function StatCard({ label, value, hint, tone = "plain" }: { label: string; value: ReactNode; hint: string; tone?: StatTone }) {
  return (
    <div className="rounded-card bg-surface-container-low p-5">
      <div className="text-body font-bold text-on-surface-muted uppercase tracking-[0.04em]">{label}</div>
      <div className={`text-metric font-bold leading-tight tracking-tight mt-1 ${STAT_TONE[tone]}`}>{value}</div>
      <div className="text-body text-on-surface-subtle">{hint}</div>
    </div>
  );
}

export default function BillingPage() {
  const t = useTranslations("app.billing");
  const tc = useTranslations("app.common");
  // `actionType` là enum của BE (`cr_clarify`…) — hiện nhãn, mã lạ ⇒ "Thao tác AI" (FLF-247)
  const actionLabel = (actionType: string): string => {
    const key = `actionType.${actionType}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : t("actionType.other");
  };
  const format = useFormatter();
  const router = useRouter();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [ledger, setLedger] = useState<CreditTransaction[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Ví là của tổ chức và chỉ Lead được nạp / đổi gói (UC-59, UC-62). Biết chắc không phải Lead thì ẩn nút mua —
  // trước đây Analyst bấm "Mua ngay" chỉ nhận câu chung chung "Vai trò của bạn không được phép...". Chưa biết vai
  // trò (đang tải / lỗi) thì vẫn hiện: BE vẫn chặn, và Lead không bao giờ bị mất nút.
  const activeOrg = useActiveOrganization();
  const canPurchase = activeOrg === null || activeOrg.role === "lead";
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    const [nextBalance, firstPage] = await Promise.all([fetchBalance(), fetchTransactions(1)]);
    setBalance(nextBalance);
    setLedger(firstPage.items);
    setLedgerPage(1);
    setLedgerTotalPages(firstPage.meta?.totalPages ?? 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [catalog] = await Promise.all([fetchPackages(), loadBalance()]);
        if (cancelled) return;
        setPackages(catalog.packages);
        setPlans(catalog.plans);
      } catch (err) {
        // Chuỗi rỗng = lỗi tải trang, dịch lúc render ⇒ `t` không phải vào dependency của effect.
        if (!cancelled) setError(userErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadBalance]);

  const handleBuy = async (pkg: CreditPackage) => {
    setBusy(pkg.id);
    setError(null);
    try {
      const checkout = await createCheckout(pkg.id);
      router.push(`/home/billing/checkout?intentId=${encodeURIComponent(checkout.intentId)}`);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.createTx")));
      setBusy(null);
    }
  };

  /** Gói trả phí đi qua checkout thật (`plan:<id>`); về gói miễn phí thì đổi ngay. */
  const handleUpgrade = async (plan: PlanDefinition) => {
    const busyKey: `plan:${PlanId}` = `plan:${plan.id}`;
    setBusy(busyKey);
    setError(null);
    try {
      if (plan.priceVnd > 0) {
        const checkout = await createCheckout(busyKey);
        router.push(`/home/billing/checkout?intentId=${encodeURIComponent(checkout.intentId)}`);
        return;
      }
      await upgradePlan(plan.id);
      await loadBalance();
      emitNotificationsChanged();
      setBusy(null);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.changePlan")));
      setBusy(null);
    }
  };

  const handleLoadMore = async () => {
    setBusy("ledger");
    try {
      const next = await fetchTransactions(ledgerPage + 1);
      setLedger((prev) => [...prev, ...next.items]);
      setLedgerPage(next.meta.page);
      setLedgerTotalPages(next.meta.totalPages);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.loadMore")));
    } finally {
      setBusy(null);
    }
  };

  const lowCredit = balance ? balance.available < balance.lowCreditThreshold : false;

  // Bốn thẻ cùng một khuôn: ba con số của ví và gói hiện tại. "credit" là đơn vị, không dịch.
  const statCards: { key: string; label: string; value: ReactNode; hint: string; tone: StatTone }[] = balance
    ? [
        { key: "available", label: t("available"), value: format.number(balance.available), hint: "credit", tone: lowCredit ? "error" : "primary" },
        { key: "balance", label: t("balance"), value: format.number(balance.balance), hint: "credit", tone: "plain" },
        { key: "reserved", label: t("reserved"), value: format.number(balance.reserved), hint: "credit", tone: "muted" },
        {
          key: "currentPlan",
          label: t("currentPlan"),
          value: balance.planLabel,
          hint: balance.subscription
            ? t("validUntil", {
                date: format.dateTime(new Date(balance.subscription.currentPeriodEnd), {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                }),
              })
            : t("defaultPlan"),
          tone: "plain",
        },
      ]
    : [];

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>

        {error !== null && (
          <div className="flex items-center gap-3 bg-error-container text-on-error-container px-4 py-3 rounded-control text-body font-medium">
            <span className="flex-1">{error || t("errors.load")}</span>
            <IconButton icon="close" label={tc("dismiss")} size="sm" onClick={() => setError(null)} className="shrink-0" />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <PageSkeleton variant="cards" label={t("loading")} />
            <PageSkeleton variant="table" rows={5} label={t("loadingHistory")} />
          </div>
        ) : (
          <>
            {/* Balance */}
            {balance && (
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                  <StatCard key={card.key} label={card.label} value={card.value} hint={card.hint} tone={card.tone} />
                ))}
              </section>
            )}

            {lowCredit && (
              <div className="bg-accent-gold-soft text-accent-gold-text px-4 py-3 rounded-control text-body font-medium">
                {t("lowCredit")}
              </div>
            )}

            {/* Packages */}
            <section className="flex flex-col gap-3">
              <h2 className="text-heading font-bold text-on-surface">{t("buyCredits")}</h2>
              {canPurchase ? null : (
                <p role="note" className="rounded-control bg-primary-soft px-3 py-2 text-body text-on-surface-medium">
                  {t("leadOnlyPurchase")}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="rounded-card bg-surface-container-low p-5 flex flex-col gap-3">
                    <div>
                      <div className="text-body font-bold text-on-surface-medium">{pkg.label}</div>
                      <div className="text-metric font-bold leading-tight tracking-tight text-on-surface">
                        {format.number(pkg.credits)}{" "}
                        <span className="text-body font-semibold text-on-surface-muted">credit</span>
                      </div>
                      <div className="text-body text-on-surface-variant">{formatVnd(pkg.amount)}</div>
                    </div>
                    {canPurchase ? (
                      // `loading` giữ nguyên nhãn và tự khoá nút ⇒ bố cục không nhảy khi đang tạo giao dịch
                      <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        className="mt-auto"
                        loading={busy === pkg.id}
                        disabled={busy !== null}
                        onClick={() => handleBuy(pkg)}
                      >
                        {t("buyNow")}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-body text-on-surface-subtle">{t("vietqrNote")}</p>
            </section>

            {/* Plans */}
            <section className="flex flex-col gap-3">
              <h2 className="text-heading font-bold text-on-surface">{t("plans")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = balance?.plan === plan.id;
                  return (
                    // Gói hiện tại đánh dấu bằng huy hiệu, không bằng viền màu — cả trang không dùng nét để phân tách
                    <div key={plan.id} className="rounded-card bg-surface-container-low p-5 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-heading font-bold text-on-surface">{plan.label}</div>
                        <div className="text-body text-on-surface-variant">
                          {t("creditsPerMonth", { credits: format.number(plan.monthlyCredits) })} ·{" "}
                          {plan.priceVnd === 0 ? t("free") : t("pricePerMonth", { price: formatVnd(plan.priceVnd) })}
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge tone="primary" size="md">
                          {t("current")}
                        </Badge>
                      ) : canPurchase ? (
                        <Button
                          variant="secondary"
                          size="md"
                          loading={busy === `plan:${plan.id}`}
                          disabled={busy !== null}
                          onClick={() => handleUpgrade(plan)}
                        >
                          {plan.priceVnd > 0 ? t("buyPlan", { plan: plan.label }) : t("switchTo", { plan: plan.label })}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ledger */}
            <section className="flex flex-col gap-3">
              <h2 className="text-heading font-bold text-on-surface">{t("history")}</h2>
              <div className="rounded-card bg-surface-container-low p-1.5 max-h-[52dvh] overflow-auto">
                {ledger.length === 0 ? (
                  <EmptyState icon="wallet" title={t("noTx")} />
                ) : (
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-left text-caption uppercase tracking-[0.04em] text-on-surface-muted">
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.time")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.type")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.action")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold text-right">{t("col.credit")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold text-right">{t("col.availableAfter")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((tx) => (
                        <tr key={tx._id} className="transition-colors hover:bg-surface-container-lowest">
                          <td className="px-4 py-2.5 text-on-surface-variant whitespace-nowrap">
                            {format.dateTime(new Date(tx.createdAt), {
                              day: "numeric",
                              month: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-on-surface font-semibold whitespace-nowrap">
                            {t.has(`txType.${tx.type}`) ? t(`txType.${tx.type}`) : t("txType.other")}
                            {tx.state && (
                              <span className="ml-1.5 text-caption font-medium text-on-surface-muted">({t(`txState.${tx.state}`)})</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-on-surface-variant">{actionLabel(tx.actionType)}</td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${
                              tx.type === "purchase" ? "text-success" : tx.type === "deduct" ? "text-error" : "text-on-surface-variant"
                            }`}
                          >
                            {signedAmount(tx)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-on-surface">{tx.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {ledgerPage < ledgerTotalPages && (
                <Button
                  variant="secondary"
                  size="md"
                  className="self-center"
                  loading={busy === "ledger"}
                  disabled={busy !== null}
                  onClick={handleLoadMore}
                >
                  {tc("loadMore")}
                </Button>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
