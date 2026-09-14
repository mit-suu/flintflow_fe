"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../../components/NotificationBell";
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

const TX_LABELS: Record<CreditTransaction["type"], string> = {
  reserve: "Giữ credit",
  deduct: "Trừ credit",
  release: "Hoàn credit",
  purchase: "Nạp credit",
  monthly_reset: "Reset hằng tháng",
};

const STATE_LABELS: Record<NonNullable<CreditTransaction["state"]>, string> = {
  reserved: "đang giữ",
  deducted: "đã trừ",
  refunded: "đã hoàn",
  expired: "hết hạn",
};

const signedAmount = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || tx.type === "monthly_reset") return `+${tx.amount}`;
  if (tx.type === "deduct") return `−${tx.amount}`;
  return String(tx.amount);
};

export default function BillingPage() {
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải thông tin thanh toán");
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
      setError(err instanceof Error ? err.message : "Không thể tạo giao dịch");
      setBusy(null);
    }
  };

  const handleUpgrade = async (plan: PlanId) => {
    setBusy(`plan:${plan}`);
    setError(null);
    try {
      await upgradePlan(plan);
      await loadBalance();
      emitNotificationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi gói");
    } finally {
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
      setError(err instanceof Error ? err.message : "Không thể tải thêm giao dịch");
    } finally {
      setBusy(null);
    }
  };

  const lowCredit = balance ? balance.available < balance.lowCreditThreshold : false;

  return (
    <>
      <div className="h-[58px] bg-white border-b border-[#E4E1DC] flex items-center px-6 gap-3.5 shrink-0 z-10">
        <div className="flex items-center gap-1.5 text-[13px] text-[#8A867E]">
          <span>Tài khoản</span>
          <span className="text-[#D6D2CB]">/</span>
          <span className="text-[#191817] font-bold">Thanh toán &amp; credit</span>
        </div>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 p-6 sm:p-8 bg-[#F5F3F0]">
        <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Thanh toán &amp; credit</h1>

        {error && (
          <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-xs font-medium">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#A8A49C] gap-3">
            <span className="w-6 h-6 rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
            <span className="text-[13px] font-medium">Đang tải thông tin thanh toán…</span>
          </div>
        ) : (
          <>
            {/* Balance */}
            {balance && (
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Khả dụng", value: balance.available, accent: lowCredit ? "#B03030" : "#4F46E5" },
                  { label: "Số dư", value: balance.balance, accent: "#191817" },
                  { label: "Đang giữ", value: balance.reserved, accent: "#8A867E" },
                ].map((card) => (
                  <div key={card.label} className="bg-white border border-[#ECEAE5] rounded-[16px] p-5">
                    <div className="text-[11.5px] font-bold text-[#8A867E] uppercase tracking-[0.04em]">
                      {card.label}
                    </div>
                    <div className="text-[28px] font-extrabold mt-1" style={{ color: card.accent }}>
                      {card.value.toLocaleString("vi-VN")}
                    </div>
                    <div className="text-[11.5px] text-[#A8A49C]">credit</div>
                  </div>
                ))}
                <div className="bg-white border border-[#ECEAE5] rounded-[16px] p-5">
                  <div className="text-[11.5px] font-bold text-[#8A867E] uppercase tracking-[0.04em]">Gói hiện tại</div>
                  <div className="text-[28px] font-extrabold mt-1 text-[#191817]">{balance.planLabel}</div>
                  <div className="text-[11.5px] text-[#A8A49C]">
                    {balance.subscription
                      ? `Hiệu lực đến ${new Date(balance.subscription.currentPeriodEnd).toLocaleDateString("vi-VN")}`
                      : "Mặc định"}
                  </div>
                </div>
              </section>
            )}

            {lowCredit && (
              <div className="bg-[#FFF6E5] border border-[#F2DDB0] text-[#7A5A12] px-4 py-3 rounded-[12px] text-[12.5px] font-medium">
                Credit khả dụng sắp hết. Nạp thêm để tiếp tục sử dụng các tính năng AI.
              </div>
            )}

            {/* Packages */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">Nạp credit</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="bg-white border border-[#ECEAE5] rounded-[16px] p-5 flex flex-col gap-3">
                    <div>
                      <div className="text-[13px] font-bold text-[#4B4842]">{pkg.label}</div>
                      <div className="text-[26px] font-extrabold text-[#191817]">
                        {pkg.credits.toLocaleString("vi-VN")}{" "}
                        <span className="text-[13px] font-semibold text-[#8A867E]">credit</span>
                      </div>
                      <div className="text-[13px] text-[#6B6862]">{formatVnd(pkg.amount)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBuy(pkg)}
                      disabled={busy !== null}
                      className="mt-auto py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {busy === pkg.id ? "Đang tạo giao dịch…" : "Mua ngay"}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-[#A8A49C]">
                Thanh toán bằng chuyển khoản ngân hàng qua mã VietQR. Credit được cộng tự động khi giao dịch được xác nhận.
              </p>
            </section>

            {/* Plans */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">Gói sử dụng</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = balance?.plan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`bg-white rounded-[16px] p-5 flex items-center gap-4 border ${
                        isCurrent ? "border-[#4F46E5]" : "border-[#ECEAE5]"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-[15px] font-extrabold text-[#191817]">{plan.label}</div>
                        <div className="text-[12.5px] text-[#6B6862]">
                          {plan.monthlyCredits.toLocaleString("vi-VN")} credit / tháng ·{" "}
                          {plan.priceVnd === 0 ? "Miễn phí" : `${formatVnd(plan.priceVnd)} / tháng`}
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="px-3 py-1 rounded-full bg-[#EEEDFD] text-[11.5px] font-bold text-[#3B34B0]">
                          Đang dùng
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={busy !== null}
                          className="px-4 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-white text-[12.5px] font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
                        >
                          {busy === `plan:${plan.id}` ? "Đang đổi…" : `Chuyển sang ${plan.label}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ledger */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-extrabold text-[#191817]">Lịch sử giao dịch</h2>
              <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-x-auto">
                {ledger.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#A8A49C]">Chưa có giao dịch nào</div>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-[#8A867E] border-b border-[#F0EEEA]">
                        <th className="px-5 py-3 font-bold">Thời gian</th>
                        <th className="px-5 py-3 font-bold">Loại</th>
                        <th className="px-5 py-3 font-bold">Hành động</th>
                        <th className="px-5 py-3 font-bold text-right">Credit</th>
                        <th className="px-5 py-3 font-bold text-right">Khả dụng sau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((tx) => (
                        <tr key={tx._id} className="border-b border-[#F7F6F3] last:border-b-0">
                          <td className="px-5 py-3 text-[#6B6862] whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-5 py-3 text-[#191817] font-semibold whitespace-nowrap">
                            {TX_LABELS[tx.type]}
                            {tx.state && (
                              <span className="ml-1.5 text-[11px] font-medium text-[#8A867E]">
                                ({STATE_LABELS[tx.state]})
                              </span>
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
                  className="self-center px-5 py-2 rounded-full border border-[#E4E1DC] bg-white text-[12.5px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
                >
                  {busy === "ledger" ? "Đang tải…" : "Tải thêm"}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
