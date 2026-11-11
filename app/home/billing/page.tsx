"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, FilterSelect, IconButton, PageSkeleton, type BadgeTone } from "@/components/ui";
import {
  createCheckout,
  fetchBalance,
  fetchPackages,
  fetchTransactions,
  formatVnd,
  type BalanceResponse,
  type CreditPackage,
  type CreditTransaction,
  type PaymentIntentStatus,
  type PlanDefinition,
  type PlanId,
  type TransactionFilters,
  type TransactionKind,
  requestCreditTopup,
} from "@/lib/api/billing";
import { fetchMembers } from "@/lib/api/orgs";
import { listProjects } from "@/lib/api/projects";
import { tPhase, tStep } from "@/lib/i18n";
import { emitNotificationsChanged } from "@/lib/api/notifications";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useActiveOrganization } from "@/lib/hooks/use-active-org";

const signedAmount = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || tx.type === "monthly_reset") return `+${tx.amount}`;
  if (tx.type === "deduct") return `−${tx.amount}`;
  return String(tx.amount);
};

/** Ô không có dữ liệu (dòng cũ chưa ghi step / token, giao dịch không gắn dự án). */
const EMPTY_CELL = "-";

const PAYMENT_TONE: Record<PaymentIntentStatus, BadgeTone> = {
  succeeded: "success",
  pending: "warning",
  failed: "danger",
};

/** Bộ lọc lịch sử — `all` = không lọc. */
interface LedgerFilters {
  kind: "all" | TransactionKind;
  memberId: string;
  projectId: string;
}

const NO_FILTERS: LedgerFilters = { kind: "all", memberId: "all", projectId: "all" };

const toApiFilters = (f: LedgerFilters): TransactionFilters => ({
  ...(f.kind !== "all" ? { kind: f.kind } : {}),
  ...(f.memberId !== "all" ? { memberId: f.memberId } : {}),
  ...(f.projectId !== "all" ? { projectId: f.projectId } : {}),
});

type FilterChoice = { value: string; label: string };

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
  const locale = useLocale();
  // Đơn vị đứng riêng dưới con số nên không dùng ICU plural (bản vi không có số nhiều)
  const creditUnit = (count: number) => t(new Intl.PluralRules(locale).select(count) === "one" ? "creditUnit.one" : "creditUnit.other");
  const router = useRouter();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [ledger, setLedger] = useState<CreditTransaction[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [filters, setFilters] = useState<LedgerFilters>(NO_FILTERS);
  const [memberChoices, setMemberChoices] = useState<FilterChoice[]>([]);
  const [projectChoices, setProjectChoices] = useState<FilterChoice[]>([]);
  // Đổi bộ lọc nhanh ⇒ chỉ nhận câu trả lời của lần đổi cuối
  const ledgerRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Ví là của tổ chức và chỉ Lead được nạp / đổi gói (UC-59, UC-62). Biết chắc không phải Lead thì ẩn nút mua —
  // trước đây Analyst bấm "Mua ngay" chỉ nhận câu chung chung "Vai trò của bạn không được phép...". Chưa biết vai
  // trò (đang tải / lỗi) thì vẫn hiện: BE vẫn chặn, và Lead không bao giờ bị mất nút.
  const activeOrg = useActiveOrganization();
  const canPurchase = activeOrg === null || activeOrg.role === "lead";
  const [error, setError] = useState<string | null>(null);
  /** FLF-332: Analyst báo Lead nạp — `sent` giữ số Lead đã được báo để nói rõ ai nhận. */
  const [topup, setTopup] = useState<{ busy: boolean; sent: number | null }>({ busy: false, sent: null });
  const requestTopup = async () => {
    setTopup({ busy: true, sent: null });
    try {
      const res = await requestCreditTopup({});
      setTopup({ busy: false, sent: res.data?.notified_leads ?? 0 });
      emitNotificationsChanged();
    } catch (err) {
      setTopup({ busy: false, sent: null });
      setError(userErrorMessage(err, t("topupRequestFailed")));
    }
  };

  const loadLedger = useCallback(async (next: LedgerFilters) => {
    const request = ++ledgerRequest.current;
    const firstPage = await fetchTransactions(1, 20, toApiFilters(next));
    if (request !== ledgerRequest.current) return;
    setLedger(firstPage.items);
    setLedgerPage(1);
    setLedgerTotalPages(firstPage.meta?.totalPages ?? 1);
  }, []);

  const loadBalance = useCallback(async () => {
    setBalance(await fetchBalance());
  }, []);

  // Lựa chọn của bộ lọc thành viên / dự án. Lỗi ở đây chỉ làm mất bộ lọc, không chặn trang.
  const activeOrgId = activeOrg?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    const loadChoices = async () => {
      const [members, projects] = await Promise.all([
        activeOrgId ? fetchMembers(activeOrgId).catch(() => []) : Promise.resolve([]),
        listProjects().then((res) => res.data ?? []).catch(() => []),
      ]);
      if (cancelled) return;
      setMemberChoices(members.map((m) => ({ value: m.userId, label: m.name?.trim() || m.email })));
      setProjectChoices(projects.map((p) => ({ value: p._id, label: p.name })));
    };
    void loadChoices();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [catalog] = await Promise.all([fetchPackages(), loadBalance(), loadLedger(NO_FILTERS)]);
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
  }, [loadBalance, loadLedger]);

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

  /** Nâng gói (UC-58) đi qua checkout thật (`plan:<id>`). Không có hạ gói (FLF-347). */
  const handleUpgrade = async (plan: PlanDefinition) => {
    const busyKey: `plan:${PlanId}` = `plan:${plan.id}`;
    setBusy(busyKey);
    setError(null);
    try {
      const checkout = await createCheckout(busyKey);
      router.push(`/home/billing/checkout?intentId=${encodeURIComponent(checkout.intentId)}`);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.changePlan")));
      setBusy(null);
    }
  };

  const handleLoadMore = async () => {
    setBusy("ledger");
    try {
      const next = await fetchTransactions(ledgerPage + 1, 20, toApiFilters(filters));
      setLedger((prev) => [...prev, ...next.items]);
      setLedgerPage(next.meta.page);
      setLedgerTotalPages(next.meta.totalPages);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.loadMore")));
    } finally {
      setBusy(null);
    }
  };

  const changeFilter = async (patch: Partial<LedgerFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setBusy("ledger");
    try {
      await loadLedger(next);
    } catch (err) {
      setError(userErrorMessage(err, t("errors.filter")));
    } finally {
      setBusy(null);
    }
  };

  const filtered = filters.kind !== "all" || filters.memberId !== "all" || filters.projectId !== "all";
  const kindOptions: { value: LedgerFilters["kind"]; label: string }[] = [
    { value: "all", label: t("filter.kindAll") },
    { value: "usage", label: t("filter.usage") },
    { value: "payment", label: t("filter.payment") },
  ];
  const memberOptions = [{ value: "all", label: t("filter.memberAll") }, ...memberChoices];
  const projectOptions = [{ value: "all", label: t("filter.projectAll") }, ...projectChoices];

  // Step của pipeline (`S-1.1`) hoặc giai đoạn khi đó là lượt phỏng vấn đầu giai đoạn (`B`)
  const stepLabel = (stepId: string) => {
    const label = tStep(stepId, locale);
    return label === stepId ? tPhase(stepId, locale) : label;
  };
  const packageLabel = (packageId?: string) => packages.find((p) => p.id === packageId)?.label ?? t("txType.purchase");
  const tokensOf = (tx: CreditTransaction) =>
    tx.tokensIn != null && tx.tokensOut != null ? `${format.number(tx.tokensIn)} / ${format.number(tx.tokensOut)}` : EMPTY_CELL;

  const lowCredit = balance ? balance.available < balance.lowCreditThreshold : false;
  const currentPlanPrice = plans.find((p) => p.id === balance?.plan)?.priceVnd ?? 0;

  // Bốn thẻ cùng một khuôn: ba con số của ví và gói hiện tại. Đơn vị "credit" giữ nguyên chữ, bản en có số nhiều.
  const statCards: { key: string; label: string; value: ReactNode; hint: string; tone: StatTone }[] = balance
    ? [
        { key: "available", label: t("available"), value: format.number(balance.available), hint: creditUnit(balance.available), tone: lowCredit ? "error" : "primary" },
        { key: "balance", label: t("balance"), value: format.number(balance.balance), hint: creditUnit(balance.balance), tone: "plain" },
        { key: "reserved", label: t("reserved"), value: format.number(balance.reserved), hint: creditUnit(balance.reserved), tone: "muted" },
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
                <div role="note" className="rounded-control bg-primary-soft px-3 py-2 text-body text-on-surface-medium flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[240px]">{t("leadOnlyPurchase")}</span>
                  {/* FLF-332 (BR-08): báo mọi Lead của tổ chức bằng thông báo in-app; nạp xong người báo được báo lại */}
                  {topup.sent === null ? (
                    <Button variant="primary" size="sm" disabled={topup.busy} onClick={() => void requestTopup()}>
                      {topup.busy ? t("topupRequesting") : t("topupRequest")}
                    </Button>
                  ) : (
                    <span className="font-semibold text-on-surface">{t("topupRequested", { count: topup.sent })}</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="rounded-card bg-surface-container-low p-5 flex flex-col gap-3">
                    <div>
                      {/* Tên gói BE gửi là tiếng Việt ("Gói 100 credit") ⇒ dựng lại từ số credit theo ngôn ngữ giao diện. */}
                      <div className="text-body font-bold text-on-surface-medium">
                        {t("packageLabel", { credits: format.number(pkg.credits) })}
                      </div>
                      <div className="text-metric font-bold leading-tight tracking-tight text-on-surface">
                        {format.number(pkg.credits)}{" "}
                        <span className="text-body font-semibold text-on-surface-muted">{creditUnit(pkg.credits)}</span>
                      </div>
                      <div className="text-body text-on-surface-variant">{formatVnd(pkg.amount, locale)}</div>
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
                  // FLF-347: bản đầu không có hạ gói (UC-58 chỉ nâng) — gói thấp hơn chỉ tới khi gói đang dùng hết kỳ
                  const isLower = plan.priceVnd < currentPlanPrice;
                  return (
                    // Gói hiện tại đánh dấu bằng huy hiệu, không bằng viền màu — cả trang không dùng nét để phân tách
                    <div key={plan.id} className="rounded-card bg-surface-container-low p-5 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-heading font-bold text-on-surface">{plan.label}</div>
                        <div className="text-body text-on-surface-variant">
                          {t("creditsPerMonth", { credits: format.number(plan.monthlyCredits) })} ·{" "}
                          {plan.priceVnd === 0 ? t("free") : t("pricePerMonth", { price: formatVnd(plan.priceVnd, locale) })}
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge tone="primary" size="md">
                          {t("current")}
                        </Badge>
                      ) : isLower ? (
                        balance?.subscription && (
                          <span className="max-w-[12rem] text-right text-body text-on-surface-muted">
                            {t("autoRevert", {
                              plan: plan.label,
                              date: format.dateTime(new Date(balance.subscription.currentPeriodEnd), {
                                day: "numeric",
                                month: "numeric",
                                year: "numeric",
                              }),
                            })}
                          </span>
                        )
                      ) : canPurchase ? (
                        <Button
                          variant="secondary"
                          size="md"
                          loading={busy === `plan:${plan.id}`}
                          disabled={busy !== null}
                          onClick={() => handleUpgrade(plan)}
                        >
                          {t("buyPlan", { plan: plan.label })}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ledger — UC-59 thanh toán (cả đang chờ / lỗi) + UC-60 chi tiết từng lượt gọi AI */}
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-heading font-bold text-on-surface">{t("history")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterSelect label={t("filter.kind")} value={filters.kind} options={kindOptions} onChange={(kind) => void changeFilter({ kind })} />
                  {projectChoices.length > 0 && (
                    <FilterSelect label={t("filter.project")} value={filters.projectId} options={projectOptions} onChange={(projectId) => void changeFilter({ projectId })} />
                  )}
                  {memberChoices.length > 0 && (
                    <FilterSelect label={t("filter.member")} value={filters.memberId} options={memberOptions} onChange={(memberId) => void changeFilter({ memberId })} />
                  )}
                </div>
              </div>
              <div className="rounded-card bg-surface-container-low p-1.5 max-h-[52dvh] overflow-auto">
                {ledger.length === 0 ? (
                  <EmptyState icon="wallet" title={filtered ? t("noTxFiltered") : t("noTx")} />
                ) : (
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-left text-caption uppercase tracking-[0.04em] text-on-surface-muted">
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.time")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.type")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.action")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.project")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold">{t("col.member")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold text-right">{t("col.tokens")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold text-right">{t("col.credit")}</th>
                        <th className="sticky top-0 bg-surface-container-low px-4 py-2.5 font-bold text-right">{t("col.availableAfter")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((tx) => {
                        const isPayment = tx.type === "payment" || tx.type === "purchase";
                        return (
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
                              {tx.paymentStatus && (
                                <Badge tone={PAYMENT_TONE[tx.paymentStatus]} className="ml-1.5">
                                  {t(`paymentStatus.${tx.paymentStatus}`)}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-on-surface-variant">
                              <div>{isPayment ? packageLabel(tx.packageId) : actionLabel(tx.actionType)}</div>
                              {tx.stepId && <div className="text-caption text-on-surface-muted">{stepLabel(tx.stepId)}</div>}
                              {tx.price != null && <div className="text-caption text-on-surface-muted">{formatVnd(tx.price, locale)}</div>}
                              {tx.type === "payment" && tx.paymentStatus === "pending" && tx.intentId && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="mt-1"
                                  onClick={() => router.push(`/home/billing/checkout?intentId=${encodeURIComponent(tx.intentId!)}`)}
                                >
                                  {t("openQr")}
                                </Button>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-on-surface-variant">{tx.project?.name || EMPTY_CELL}</td>
                            <td className="px-4 py-2.5 text-on-surface-variant whitespace-nowrap">{tx.member?.name || EMPTY_CELL}</td>
                            <td className="px-4 py-2.5 text-right text-on-surface-variant whitespace-nowrap">{tokensOf(tx)}</td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold ${
                                tx.type === "purchase" ? "text-success" : tx.type === "deduct" ? "text-error" : "text-on-surface-variant"
                              }`}
                            >
                              {signedAmount(tx)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-on-surface">{tx.balanceAfter ?? EMPTY_CELL}</td>
                          </tr>
                        );
                      })}
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
