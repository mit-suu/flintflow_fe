"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Badge, Button, EmptyState, Icon, IconButton, PagedDataList, type BadgeTone } from "@/components/ui";
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
import { useActiveOrganizationState } from "@/lib/hooks/use-active-org";
import BillingShell, { BillingTopSkeleton, LEDGER_META, LEDGER_ROW_CLASS, LEDGER_SKELETON_ROWS, LedgerColumnHeader, LedgerRowSkeleton, LedgerToolbar } from "@/components/page-shells/BillingShell";
import { usePagedList } from "@/lib/hooks/use-paged-list";

const signedAmount = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || tx.type === "monthly_reset") return `+${tx.amount}`;
  if (tx.type === "deduct") return `−${tx.amount}`;
  if (tx.type === "admin_adjust") {
    if (tx.direction === "credit") return `+${tx.amount}`;
    if (tx.direction === "debit") return `−${tx.amount}`;
  }
  return String(tx.amount);
};

const amountToneClass = (tx: CreditTransaction) => {
  if (tx.type === "purchase" || (tx.type === "admin_adjust" && tx.direction === "credit")) return "text-success";
  if (tx.type === "deduct" || (tx.type === "admin_adjust" && tx.direction === "debit")) return "text-error";
  return "text-on-surface-variant";
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

const LEDGER_PAGE_SIZE = 20;

/** Ô số phụ trong khối ví (số dư, đang giữ): tham chiếu, nhỏ hơn hẳn con số khả dụng. */
function WalletFigure({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-control bg-surface-container-lowest/70 px-4 py-3">
      <dt className="text-caption font-bold uppercase tracking-[0.04em] text-on-surface-muted">{label}</dt>
      <dd className="mt-0.5 text-heading font-bold text-on-surface tabular-nums">
        <span>{value}</span> <span className="text-body font-medium text-on-surface-muted">{unit}</span>
      </dd>
    </div>
  );
}

/** Dòng tính năng của thẻ gói: dấu tích + chữ. */
function PlanFeature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-on-surface-variant">
      <Icon name="check" size={14} weight="bold" className="mt-[3px] shrink-0 text-primary" />
      <span>{children}</span>
    </li>
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
  const [filters, setFilters] = useState<LedgerFilters>(NO_FILTERS);
  const [memberChoices, setMemberChoices] = useState<FilterChoice[]>([]);
  const [projectChoices, setProjectChoices] = useState<FilterChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Ví là của tổ chức và chỉ Lead được nạp / đổi gói (UC-59, UC-62). Biết chắc không phải Lead thì ẩn nút mua —
  // trước đây Analyst bấm "Mua ngay" chỉ nhận câu chung chung "Vai trò của bạn không được phép...". Đang tải tổ chức
  // (`orgLoading`) thì giữ skeleton và chặn mọi lời gọi API theo vai trò; xong mà không thuộc org nào (`activeOrg === null`)
  // vẫn hiện nút (BE vẫn chặn, Lead không bị mất nút).
  const { org: activeOrg, loading: orgLoading, error: orgError } = useActiveOrganizationState();
  const isViewer = !orgLoading && !orgError && activeOrg?.role === "viewer";
  const billingBlocked = orgLoading || orgError || isViewer;
  const canPurchase = !billingBlocked && (activeOrg === null || activeOrg.role === "lead");
  const activeOrgId = activeOrg?.id ?? null;
  const showLoading = orgLoading || loading;
  const effectiveFilters: LedgerFilters = !canPurchase && filters.kind === "payment" ? { ...filters, kind: "all" } : filters;
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

  // Lịch sử theo số trang (FLF-404): đổi bộ lọc ⇒ về trang 1; phản hồi của bộ lọc / trang cũ về muộn bị bỏ
  const ledger = usePagedList<CreditTransaction>({
    key: JSON.stringify({ orgId: activeOrgId, filters: effectiveFilters }),
    enabled: !billingBlocked,
    fetchPage: (page) => fetchTransactions(page, LEDGER_PAGE_SIZE, toApiFilters(effectiveFilters)),
  });

  const loadBalance = useCallback(async () => {
    setBalance(await fetchBalance());
  }, []);

  // Lựa chọn của bộ lọc thành viên / dự án. Lỗi ở đây chỉ làm mất bộ lọc, không chặn trang.
  useEffect(() => {
    if (billingBlocked) return;
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
  }, [activeOrgId, billingBlocked]);

  useEffect(() => {
    if (isViewer) router.replace("/home");
  }, [isViewer, router]);

  useEffect(() => {
    if (billingBlocked) return;
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
  }, [activeOrgId, billingBlocked, loadBalance]);

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

  const changeFilter = (patch: Partial<LedgerFilters>) => setFilters((prev) => ({ ...prev, ...patch }));
  // Chuỗi rỗng từ `userErrorMessage` = không có câu của BE ⇒ câu chung
  const ledgerError = ledger.error ? userErrorMessage(ledger.error) || t("errors.loadHistory") : null;

  const filtered = effectiveFilters.kind !== "all" || effectiveFilters.memberId !== "all" || effectiveFilters.projectId !== "all";
  const kindOptions: { value: LedgerFilters["kind"]; label: string }[] = [
    { value: "all", label: t("filter.kindAll") },
    { value: "usage", label: t("filter.usage") },
    ...(canPurchase ? [{ value: "payment" as const, label: t("filter.payment") }] : []),
  ];
  const memberOptions = [{ value: "all", label: t("filter.memberAll") }, ...memberChoices];
  const projectOptions = [{ value: "all", label: t("filter.projectAll") }, ...projectChoices];

  // Step của pipeline (`S-1.1`) hoặc giai đoạn khi đó là lượt phỏng vấn đầu giai đoạn (`B`)
  const stepLabel = (stepId: string) => {
    const label = tStep(stepId, locale);
    return label === stepId ? tPhase(stepId, locale) : label;
  };
  const packageLabel = (packageId?: string | null) => {
    if (packageId?.startsWith("plan:")) {
      const planId = packageId.slice("plan:".length);
      const matchedPlan = plans.find((p) => p.id === planId);
      return matchedPlan ? t("buyPlan", { plan: matchedPlan.label }) : t("txType.purchase");
    }
    const matchedPkg = packages.find((p) => p.id === packageId);
    if (matchedPkg) {
      return matchedPkg.credits != null ? t("packageLabel", { credits: format.number(matchedPkg.credits) }) : matchedPkg.label;
    }
    return t("txType.purchase");
  };
  const tokensOf = (tx: CreditTransaction) =>
    tx.tokensIn != null && tx.tokensOut != null ? `${format.number(tx.tokensIn)} / ${format.number(tx.tokensOut)}` : EMPTY_CELL;

  const lowCredit = balance ? balance.available < balance.lowCreditThreshold : false;
  const currentPlanDef = plans.find((p) => p.id === balance?.plan);
  const currentPlanPrice = currentPlanDef?.priceVnd ?? 0;
  const rawPlanLimits =
    balance?.planLimits ??
    (currentPlanDef?.maxMembers != null && currentPlanDef?.maxProjects != null
      ? {
          maxMembers: currentPlanDef.maxMembers,
          maxProjects: currentPlanDef.maxProjects,
          maxReferenceTokens: currentPlanDef.maxReferenceTokens,
        }
      : null);
  const currentPlanLimits = rawPlanLimits
    ? {
        ...rawPlanLimits,
        maxReferenceTokens: rawPlanLimits.maxReferenceTokens ?? currentPlanDef?.maxReferenceTokens,
      }
    : null;

  if (isViewer) return null;

  const formatPlanLimits = ({
    maxMembers,
    maxProjects,
    maxReferenceTokens,
  }: {
    maxMembers: number;
    maxProjects: number;
    maxReferenceTokens?: number | null;
  }) => {
    const base = {
      members: format.number(maxMembers),
      projects: format.number(maxProjects),
    };
    return maxReferenceTokens != null
      ? t("planLimitsSummary", { ...base, tokens: format.number(maxReferenceTokens) })
      : t("planLimitsSummaryLegacy", base);
  };

  const shortDate = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "numeric", year: "numeric" });
  // Gói credit rẻ nhất tính trên mỗi credit ⇒ đánh dấu "tiết kiệm nhất" và là nút chính duy nhất của hàng (chỉ khi có >= 2 gói)
  const unitPrice = (pkg: CreditPackage) => (pkg.credits > 0 ? pkg.amount / pkg.credits : Number.POSITIVE_INFINITY);
  const bestPackageId =
    packages.length > 1 ? packages.reduce((best, pkg) => (unitPrice(pkg) < unitPrice(best) ? pkg : best)).id : null;
  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <BillingShell
        alert={
          (error !== null || orgError) && (
            <div className="flex items-center gap-3 bg-error-container text-on-error-container px-4 py-3 rounded-control text-body font-medium">
              <span className="flex-1">{error || t("errors.load")}</span>
              {error !== null && <IconButton icon="close" label={tc("dismiss")} size="sm" onClick={() => setError(null)} className="shrink-0" />}
            </div>
          )
        }
      >
        {orgError ? null : showLoading ? (
          <BillingTopSkeleton />
        ) : (
          <>
            {/* Ví + gói hiện tại. Khả dụng là con số người dùng theo dõi ⇒ to nhất trang; số dư và đang giữ chỉ để đối chiếu */}
            {balance && (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className={`rounded-card p-6 flex flex-col gap-5 ${lowCredit ? "bg-accent-gold-soft" : "bg-primary-soft"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-body font-semibold text-on-surface-medium">
                      <Icon name="wallet" size={16} />
                      {t("available")}
                    </div>
                    {canPurchase && packages.length > 0 ? (
                      <Button size="sm" icon="plus" onClick={() => scrollToSection("buy-credits")}>
                        {t("buyCredits")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {/* Số hero của trang: lớn hơn bậc `metric` một nấc có chủ ý */}
                    <span className={`text-[44px] font-bold leading-none tracking-tight tabular-nums ${lowCredit ? "text-error" : "text-primary"}`}>
                      {format.number(balance.available)}
                    </span>
                    <span className="text-heading font-semibold text-on-surface-muted">{creditUnit(balance.available)}</span>
                  </div>
                  {lowCredit && (
                    <p className="flex items-start gap-2 text-body font-medium text-accent-gold-text">
                      <Icon name="warning" size={15} className="mt-[3px] shrink-0" />
                      {t("lowCredit")}
                    </p>
                  )}
                  <dl className="mt-auto grid grid-cols-2 gap-3">
                    <WalletFigure label={t("balance")} value={format.number(balance.balance)} unit={creditUnit(balance.balance)} />
                    <WalletFigure label={t("reserved")} value={format.number(balance.reserved)} unit={creditUnit(balance.reserved)} />
                  </dl>
                </div>

                <div className="rounded-card bg-surface-container-low p-6 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-body font-semibold text-on-surface-medium">
                    <Icon name="layers" size={16} />
                    {t("currentPlan")}
                  </div>
                  <div className="mt-2 text-title font-bold text-on-surface">{balance.planLabel}</div>
                  <div className="flex items-center gap-1.5 text-body text-on-surface-variant">
                    <Icon name="clock" size={14} className="shrink-0 text-on-surface-muted" />
                    {balance.subscription ? t("validUntil", { date: shortDate(balance.subscription.currentPeriodEnd) }) : t("defaultPlan")}
                  </div>
                  {currentPlanLimits && (
                    <div className="mt-3 flex items-start gap-1.5 rounded-control bg-surface-container-lowest/70 px-3 py-2.5 text-body text-on-surface-variant leading-[1.6]">
                      <Icon name="users" size={14} className="mt-[4px] shrink-0 text-on-surface-muted" />
                      <span>{formatPlanLimits(currentPlanLimits)}</span>
                    </div>
                  )}
                  {plans.length > 1 && (
                    <Button variant="ghost" size="sm" className="mt-auto self-start -ml-2" onClick={() => scrollToSection("plans")}>
                      {t("comparePlans")}
                    </Button>
                  )}
                </div>
              </section>
            )}

            {/* Gói credit */}
            <section id="buy-credits" className="flex flex-col gap-3 scroll-mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-subtitle font-bold text-on-surface">{t("buyCredits")}</h2>
                <p className="text-body text-on-surface-muted">{t("vietqrNote")}</p>
              </div>
              {canPurchase ? null : (
                <div role="note" className="rounded-control bg-primary-soft px-4 py-3 text-body text-on-surface-medium flex flex-wrap items-center gap-3">
                  <Icon name="info" size={16} className="shrink-0 text-primary" />
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
                {packages.map((pkg) => {
                  const best = pkg.id === bestPackageId;
                  return (
                    <div key={pkg.id} className={`rounded-card p-5 flex flex-col gap-4 ${best ? "bg-primary-soft" : "bg-surface-container-low"}`}>
                      <div className="flex items-center justify-between gap-2">
                        {/* Tên gói BE gửi là tiếng Việt ("Gói 100 credit") ⇒ dựng lại từ số credit theo ngôn ngữ giao diện. */}
                        <span className="text-body font-semibold text-on-surface-medium">
                          {t("packageLabel", { credits: format.number(pkg.credits) })}
                        </span>
                        {best && <Badge tone="primary">{t("bestValue")}</Badge>}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-metric font-bold text-on-surface tabular-nums">{format.number(pkg.credits)}</span>
                        <span className="text-body font-semibold text-on-surface-muted">{creditUnit(pkg.credits)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-heading font-bold text-on-surface tabular-nums">{formatVnd(pkg.amount, locale)}</span>
                        {pkg.credits > 0 && (
                          <span className="text-caption text-on-surface-muted tabular-nums">
                            {t("perCredit", { price: formatVnd(Math.round(pkg.amount / pkg.credits), locale) })}
                          </span>
                        )}
                      </div>
                      {canPurchase ? (
                        // `loading` giữ nguyên nhãn và tự khoá nút ⇒ bố cục không nhảy khi đang tạo giao dịch
                        <Button
                          variant={best || bestPackageId === null ? "primary" : "secondary"}
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
                  );
                })}
              </div>
            </section>

            {/* Gói tháng: thẻ so sánh cạnh nhau, gói đang dùng tô nền tím nhạt (không dùng viền) */}
            <section id="plans" className="flex flex-col gap-3 scroll-mt-6">
              <h2 className="text-subtitle font-bold text-on-surface">{t("plans")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = balance?.plan === plan.id;
                  // FLF-347: bản đầu không có hạ gói (UC-58 chỉ nâng) — gói thấp hơn chỉ tới khi gói đang dùng hết kỳ
                  const isLower = plan.priceVnd < currentPlanPrice;
                  return (
                    <div key={plan.id} className={`rounded-card p-5 flex flex-col gap-4 ${isCurrent ? "bg-primary-soft" : "bg-surface-container-low"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-subtitle font-bold text-on-surface">{plan.label}</span>
                          <span className="text-heading font-semibold text-on-surface-variant tabular-nums">
                            {t("pricePerMonth", { price: formatVnd(plan.priceVnd, locale) })}
                          </span>
                        </div>
                        {isCurrent && (
                          <Badge tone="primary" size="md">
                            {t("current")}
                          </Badge>
                        )}
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        <PlanFeature>{t("creditsPerMonth", { credits: format.number(plan.monthlyCredits) })}</PlanFeature>
                        {plan.maxMembers != null && plan.maxProjects != null && (
                          <PlanFeature>
                            {formatPlanLimits({
                              maxMembers: plan.maxMembers,
                              maxProjects: plan.maxProjects,
                              maxReferenceTokens: plan.maxReferenceTokens,
                            })}
                          </PlanFeature>
                        )}
                      </ul>
                      {isCurrent ? null : isLower ? (
                        balance?.subscription && (
                          <p className="mt-auto text-body text-on-surface-muted">
                            {t("autoRevert", { plan: plan.label, date: shortDate(balance.subscription.currentPeriodEnd) })}
                          </p>
                        )
                      ) : canPurchase ? (
                        <Button
                          variant="secondary"
                          size="md"
                          fullWidth
                          className="mt-auto"
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
          </>
        )}

        {/* Ledger — UC-59 thanh toán (cả đang chờ / lỗi) + UC-60 chi tiết từng lượt gọi AI. Tải song song với ví, theo số trang. */}
        {!billingBlocked && (
          <section aria-label={t("history")} className="flex flex-col gap-3">
          <LedgerToolbar
            kind={effectiveFilters.kind}
            kindOptions={kindOptions}
            onKindChange={(kind) => changeFilter({ kind })}
            projectId={effectiveFilters.projectId}
            projectOptions={projectOptions}
            onProjectChange={(projectId) => changeFilter({ projectId })}
            memberId={effectiveFilters.memberId}
            memberOptions={memberOptions}
            onMemberChange={(memberId) => changeFilter({ memberId })}
          />

          {ledgerError && (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {ledgerError}
            </p>
          )}

          <PagedDataList
            list={ledger}
            getKey={(tx) => tx._id}
            loadingLabel={t("loadingHistory")}
            skeletonRows={LEDGER_SKELETON_ROWS}
            rowClassName={LEDGER_ROW_CLASS}
            renderSkeletonRow={LedgerRowSkeleton}
            empty={
              !ledger.error && (
                <EmptyState icon="wallet" title={filtered ? t("noTxFiltered") : t("noTx")} className="rounded-card bg-surface-container-low" />
              )
            }
            header={<LedgerColumnHeader />}
            renderItem={(tx) => {
              const isPayment = tx.type === "payment" || tx.type === "purchase";
              return (
                <>
                  <span className={`${LEDGER_META} xl:text-on-surface-variant whitespace-nowrap`}>
                    {format.dateTime(new Date(tx.createdAt), {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="max-xl:order-1 max-xl:flex-1 text-on-surface font-semibold">
                    {t.has(`txType.${tx.type}`) ? t(`txType.${tx.type}`) : t("txType.other")}
                    {tx.state && <span className="ml-1.5 text-caption font-medium text-on-surface-muted">({t(`txState.${tx.state}`)})</span>}
                    {tx.paymentStatus && (
                      <Badge tone={PAYMENT_TONE[tx.paymentStatus]} className="ml-1.5">
                        {t(`paymentStatus.${tx.paymentStatus}`)}
                      </Badge>
                    )}
                  </span>
                  <div className="max-xl:order-3 max-xl:basis-full min-w-0 text-on-surface-variant">
                    <div>{isPayment ? packageLabel(tx.packageId) : actionLabel(tx.actionType)}</div>
                    {tx.stepId && <div className="text-caption text-on-surface-muted">{stepLabel(tx.stepId)}</div>}
                    {isPayment && tx.price != null && <div className="text-caption text-on-surface-muted">{formatVnd(tx.price, locale)}</div>}
                    {isPayment && tx.referenceCode && (
                      <div className="text-caption text-on-surface-muted">{t("referenceCodeLabel", { code: tx.referenceCode })}</div>
                    )}
                    {tx.type === "payment" && tx.paymentStatus === "pending" && tx.intentId && (
                      <Button variant="secondary" size="sm" className="mt-1" onClick={() => router.push(`/home/billing/checkout?intentId=${encodeURIComponent(tx.intentId!)}`)}>
                        {t("openQr")}
                      </Button>
                    )}
                  </div>
                  <span className={`${LEDGER_META} xl:text-on-surface-variant min-w-0 truncate`}>{tx.project?.name || EMPTY_CELL}</span>
                  <span className={`${LEDGER_META} xl:text-on-surface-variant min-w-0 truncate`}>{tx.member?.name || EMPTY_CELL}</span>
                  <span className={`${LEDGER_META} xl:text-right xl:text-on-surface-variant whitespace-nowrap`}>
                    <span className="xl:hidden">{t("col.tokens")}: </span>
                    {tokensOf(tx)}
                  </span>
                  <span
                    className={`max-xl:order-2 text-right font-bold whitespace-nowrap ${amountToneClass(tx)}`}
                  >
                    {signedAmount(tx)}
                  </span>
                  <span className={`${LEDGER_META} xl:text-right xl:text-on-surface whitespace-nowrap`}>
                    <span className="xl:hidden">{t("col.availableAfter")}: </span>
                    {tx.balanceAfter ?? EMPTY_CELL}
                  </span>
                </>
              );
            }}
          />
          </section>
        )}
      </BillingShell>
    </>
  );
}
