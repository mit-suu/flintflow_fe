"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DataListSkeleton, FilterSelect, Icon, PAGE_GUTTER, Skeleton, STICKY_BLEED, STICKY_FADE, type FilterOption } from "@/components/ui";
import type { OrgRole } from "@/types/organization";

/**
 * Cột của lịch sử từ `xl`: thời gian | loại | thao tác | dự án | thành viên | token | credit | khả dụng sau.
 * Dưới `xl` một dòng gọn ba hàng: loại + credit, thao tác, rồi các ô còn lại cỡ chữ nhỏ (`order-*`).
 */
export const LEDGER_GRID =
  "xl:grid xl:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_140px_120px_72px_84px] xl:items-center xl:gap-3";
/** Ô phụ dưới `xl`: hàng cuối, chữ nhỏ. */
export const LEDGER_META = "max-xl:order-4 max-xl:text-caption max-xl:text-on-surface-muted";
export const LEDGER_ROW_CLASS = `flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body ${LEDGER_GRID}`;
export const LEDGER_SKELETON_ROWS = 5;

/**
 * Khung trang Thanh toán & credit: vùng cuộn + tiêu đề trang + thanh báo lỗi. Trang thật và khung chờ đăng nhập
 * (`ShellSkeleton`) cùng dựng từ đây và từ các khối giữ chỗ bên dưới ⇒ lúc tải lại, hình trùng nhau.
 */
export default function BillingShell({ alert, children }: { alert?: ReactNode; children: ReactNode }) {
  const t = useTranslations("app.billing");
  return (
    // Vùng cuộn không có padding trên: thanh lọc lịch sử `sticky top-0` tính từ mép trong của padding
    <div className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-6 pb-scroll-end bg-surface-container-lowest ${PAGE_GUTTER}`}>
      <h1 className="mt-6 sm:mt-8 text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
      {alert}
      {children}
    </div>
  );
}

/**
 * Giữ chỗ phần trên trang: khối ví + gói hiện tại, hàng gói credit, gói tháng. Nhãn, icon, tiêu đề mục là chữ cố định nên vẽ
 * thật; số credit, tên gói, giá là thanh giữ chỗ.
 */
export function BillingTopSkeleton() {
  const t = useTranslations("app.billing");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6" data-testid="page-skeleton">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-card p-6 flex flex-col gap-5 bg-primary-soft">
          <div className="flex items-center gap-2 text-body font-semibold text-on-surface-medium">
            <Icon name="wallet" size={16} />
            {t("available")}
          </div>
          <Skeleton className="h-11 w-36" />
          <dl className="mt-auto grid grid-cols-2 gap-3">
            {[t("balance"), t("reserved")].map((figure) => (
              <div key={figure} className="rounded-control bg-surface-container-lowest/70 px-4 py-3">
                <dt className="text-caption font-bold uppercase tracking-[0.04em] text-on-surface-muted">{figure}</dt>
                <dd className="mt-1.5">
                  <Skeleton className="h-4 w-20" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-card bg-surface-container-low p-6 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-body font-semibold text-on-surface-medium">
            <Icon name="layers" size={16} />
            {t("currentPlan")}
          </div>
          <Skeleton className="mt-2 h-6 w-24" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-3 h-11 w-full" />
        </div>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-subtitle font-bold text-on-surface">{t("buyCredits")}</h2>
          <p className="text-body text-on-surface-muted">{t("vietqrNote")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card p-5 flex flex-col gap-4 bg-surface-container-low">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-subtitle font-bold text-on-surface">{t("plans")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-card p-5 flex flex-col gap-4 bg-surface-container-low">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Tiêu đề lịch sử + ba bộ lọc, dính ở đầu vùng cuộn khi lướt lịch sử dài. */
export function LedgerToolbar<K extends string>({
  kind,
  kindOptions,
  onKindChange,
  projectId,
  projectOptions,
  onProjectChange,
  memberId,
  memberOptions,
  onMemberChange,
}: {
  kind: K;
  kindOptions: readonly FilterOption<K>[];
  onKindChange: (value: K) => void;
  projectId: string;
  projectOptions: readonly FilterOption<string>[];
  onProjectChange: (value: string) => void;
  memberId: string;
  memberOptions: readonly FilterOption<string>[];
  onMemberChange: (value: string) => void;
}) {
  const t = useTranslations("app.billing");
  return (
    <div className={`sticky top-0 z-30 -mt-3 py-3 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-2 ${STICKY_BLEED} ${STICKY_FADE}`}>
      <h2 className="text-subtitle font-bold text-on-surface">{t("history")}</h2>
      {/* Ba bộ lọc luôn có mặt (lựa chọn dự án / thành viên điền sau) ⇒ thanh không đổi hình khi danh sách lựa chọn về */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label={t("filter.kind")} value={kind} options={kindOptions} onChange={onKindChange} />
        <FilterSelect label={t("filter.project")} value={projectId} options={projectOptions} onChange={onProjectChange} />
        <FilterSelect label={t("filter.member")} value={memberId} options={memberOptions} onChange={onMemberChange} />
      </div>
    </div>
  );
}

/** Hàng tiêu đề cột — chỉ có khi các ô thẳng cột (từ `xl`). */
export function LedgerColumnHeader() {
  const t = useTranslations("app.billing");
  return (
    <div aria-hidden className={`hidden ${LEDGER_GRID} px-3 pt-1.5 pb-2 text-caption uppercase tracking-[0.04em] font-bold text-on-surface-muted`}>
      <span>{t("col.time")}</span>
      <span>{t("col.type")}</span>
      <span>{t("col.action")}</span>
      <span>{t("col.project")}</span>
      <span>{t("col.member")}</span>
      <span className="text-right">{t("col.tokens")}</span>
      <span className="text-right">{t("col.credit")}</span>
      <span className="text-right">{t("col.availableAfter")}</span>
    </div>
  );
}

/** Dòng giữ chỗ cùng lưới cột với dòng thật; dưới `xl` gọn ba hàng như dòng thật: loại + credit, thao tác, rồi các ô phụ. */
export function LedgerRowSkeleton() {
  return (
    <>
      <Skeleton className={`h-3 w-28 ${LEDGER_META}`} />
      <Skeleton className="h-3.5 w-24 max-xl:order-1 max-xl:flex-1 max-xl:max-w-24" />
      <Skeleton className="h-3.5 w-32 max-xl:order-3 max-xl:basis-full max-xl:max-w-40" />
      <Skeleton className={`h-3 w-20 ${LEDGER_META}`} />
      <Skeleton className={`h-3 w-20 ${LEDGER_META}`} />
      <Skeleton className={`h-3 w-16 xl:justify-self-end ${LEDGER_META}`} />
      <Skeleton className="h-3.5 w-8 xl:justify-self-end max-xl:order-2" />
      <Skeleton className={`h-3 w-10 xl:justify-self-end ${LEDGER_META}`} />
    </>
  );
}

const noop = () => undefined;

/** Trang Thanh toán lúc đang tải lần đầu, dùng cho khung chờ đăng nhập. Viewer không có trang này (bị đẩy về /home). */
export function BillingLoading({ role }: { role: OrgRole | null }) {
  const t = useTranslations("app.billing");
  const kindOptions: FilterOption<string>[] = [
    { value: "all", label: t("filter.kindAll") },
    { value: "usage", label: t("filter.usage") },
    ...(role === "lead" ? [{ value: "payment", label: t("filter.payment") }] : []),
  ];
  return (
    <BillingShell>
      <BillingTopSkeleton />
      <section aria-label={t("history")} className="flex flex-col gap-3">
        <LedgerToolbar
          kind="all"
          kindOptions={kindOptions}
          onKindChange={noop}
          projectId="all"
          projectOptions={[{ value: "all", label: t("filter.projectAll") }]}
          onProjectChange={noop}
          memberId="all"
          memberOptions={[{ value: "all", label: t("filter.memberAll") }]}
          onMemberChange={noop}
        />
        <DataListSkeleton
          header={<LedgerColumnHeader />}
          rowClassName={LEDGER_ROW_CLASS}
          rows={LEDGER_SKELETON_ROWS}
          label={t("loadingHistory")}
          renderSkeletonRow={LedgerRowSkeleton}
        />
      </section>
    </BillingShell>
  );
}
