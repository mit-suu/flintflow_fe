"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageSkeleton from "@/components/ui/PageSkeleton";
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
} from "../../../lib/api/billing";
import { emitNotificationsChanged } from "../../../lib/api/notifications";

const signedAmount = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || tx.type === "monthly_reset") return `+${tx.amount}`;
  if (tx.type === "deduct") return `−${tx.amount}`;
  return String(tx.amount);
};

export default function BillingPage() {
  const t = useTranslations("app.billing");
  const tc = useTranslations("app.common");
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
        if (!cancelled) setError(err instanceof Error ? err.message : "");
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
      setError(err instanceof Error ? err.message : t("errors.createTx"));
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
      setError(err instanceof Error ? err.message : t("errors.changePlan"));
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
      setError(err instanceof Error ? err.message : t("errors.loadMore"));
    } finally {
      setBusy(null);
    }
  };

  const lowCredit = balance ? balance.available < balance.lowCreditThreshold : false;

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 p-6 sm:p-8 bg-surface-container-lowest">
        <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">{t("title")}</h1>

        {error !== null && (
          <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-control text-xs font-medium">
            <span className="flex-1">{error || t("errors.load")}</span>
            <button type="button" onClick={() => setError(null)} aria-label={tc("dismiss")} className="font-bold hover:opacity-75">
              ✕
            </button>
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
                {[
                  { key: "available" as const, value: balance.available, accent: lowCredit ? "#B03030" : "#6A62C4" },
                  { key: "balance" as const, value: balance.balance, accent: "#191817" },
                  { key: "reserved" as const, value: balance.reserved, accent: "#8A867E" },
                ].map((card) => (
                  <div key={card.key} className="bg-white border border-[#ECEAE5] rounded-card p-5">
                    <div className="text-[11.5px] font-bold text-[#8A867E] uppercase tracking-[0.04em]">
                      {t(card.key)}
                    </div>
                    <div className="text-[28px] font-extrabold mt-1" style={{ color: card.accent }}>
                      {format.number(card.value)}
                    </div>
                    <div className="text-[11.5px] text-[#A8A49C]">credit</div>
                  </div>
                ))}
                <div className="bg-white border border-[#ECEAE5] rounded-card p-5">
                  <div className="text-[11.5px] font-bold text-[#8A867E] uppercase tracking-[0.04em]">{t("currentPlan")}</div>
                  <div className="text-[28px] font-extrabold mt-1 text-[#191817]">{balance.planLabel}</div>
                  <div className="text-[11.5px] text-[#A8A49C]">
                    {balance.subscription
                      ? t("validUntil", {
                          date: format.dateTime(new Date(balance.subscription.currentPeriodEnd), {
                            day: "numeric",
                            month: "numeric",
                            year: "numeric",
                          }),
                        })
                      : t("defaultPlan")}
                  </div>
                </div>
              </section>
            )}

            {lowCredit && (
              <div className="bg-[#FFF6E5] border border-[#F2DDB0] text-[#7A5A12] px-4 py-3 rounded-control text-[12.5px] font-medium">
                {t("lowCredit")}
              </div>
            )}

            {/* Packages */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">{t("buyCredits")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="bg-white border border-[#ECEAE5] rounded-card p-5 flex flex-col gap-3">
                    <div>
                      <div className="text-[13px] font-bold text-[#4B4842]">{pkg.label}</div>
                      <div className="text-[26px] font-extrabold text-[#191817]">
                        {format.number(pkg.credits)}{" "}
                        <span className="text-[13px] font-semibold text-[#8A867E]">credit</span>
                      </div>
                      <div className="text-[13px] text-[#6B6862]">{formatVnd(pkg.amount)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBuy(pkg)}
                      disabled={busy !== null}
                      className="mt-auto py-2.5 rounded-control btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {busy === pkg.id ? t("creatingTx") : t("buyNow")}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-[#A8A49C]">
                {t("vietqrNote")}
              </p>
            </section>

            {/* Plans */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">{t("plans")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = balance?.plan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`bg-white rounded-card p-5 flex items-center gap-4 border ${
                        isCurrent ? "border-[#6A62C4]" : "border-[#ECEAE5]"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-[15px] font-extrabold text-[#191817]">{plan.label}</div>
                        <div className="text-[12.5px] text-[#6B6862]">
                          {t("creditsPerMonth", { credits: format.number(plan.monthlyCredits) })} ·{" "}
                          {plan.priceVnd === 0 ? t("free") : t("pricePerMonth", { price: formatVnd(plan.priceVnd) })}
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="px-3 py-1 rounded-full bg-[#EFEEF9] text-[11.5px] font-bold text-[#554DB0]">
                          {t("current")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgrade(plan)}
                          disabled={busy !== null}
                          className="px-4 py-2 rounded-control border-[1.5px] border-[#E4E1DC] bg-white text-[12.5px] font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
                        >
                          {busy === `plan:${plan.id}`
                            ? plan.priceVnd > 0
                              ? t("creatingTx")
                              : t("switching")
                            : plan.priceVnd > 0
                              ? t("buyPlan", { plan: plan.label })
                              : t("switchTo", { plan: plan.label })}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ledger */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">{t("history")}</h2>
              <div className="bg-white border border-[#ECEAE5] rounded-card overflow-x-auto">
                {ledger.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#A8A49C]">{t("noTx")}</div>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-[#8A867E] border-b border-[#F0EEEA]">
                        <th className="px-5 py-3 font-bold">{t("col.time")}</th>
                        <th className="px-5 py-3 font-bold">{t("col.type")}</th>
                        <th className="px-5 py-3 font-bold">{t("col.action")}</th>
                        <th className="px-5 py-3 font-bold text-right">{t("col.credit")}</th>
                        <th className="px-5 py-3 font-bold text-right">{t("col.availableAfter")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((tx) => (
                        <tr key={tx._id} className="border-b border-[#F7F6F3] last:border-b-0">
                          <td className="px-5 py-3 text-[#6B6862] whitespace-nowrap">
                            {format.dateTime(new Date(tx.createdAt), {
                              day: "numeric",
                              month: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-5 py-3 text-[#191817] font-semibold whitespace-nowrap">
                            {t(`txType.${tx.type}`)}
                            {tx.state && (
                              <span className="ml-1.5 text-[11px] font-medium text-[#8A867E]">({t(`txState.${tx.state}`)})</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[#6B6862]">{tx.actionType}</td>
                          <td
                            className={`px-5 py-3 text-right font-bold ${
                              tx.type === "purchase" ? "text-[#2F7A4F]" : tx.type === "deduct" ? "text-[#B03030]" : "text-[#6B6862]"
                            }`}
                          >
                            {signedAmount(tx)}
                          </td>
                          <td className="px-5 py-3 text-right text-[#191817]">{tx.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {ledgerPage < ledgerTotalPages && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={busy !== null}
                  className="self-center px-5 py-2 rounded-control border border-[#E4E1DC] bg-white text-[12.5px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
                >
                  {busy === "ledger" ? tc("loading") : tc("loadMore")}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
