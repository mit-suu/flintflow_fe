"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, CountBadge, DataListSkeleton, FilterSelect, Icon, PAGE_GUTTER, SearchInput, Skeleton, STICKY_BLEED, STICKY_FADE } from "@/components/ui";
import type { OrgTemplateSort } from "@/lib/api/org-library";
import type { OrgRole } from "@/types/organization";

export const LIBRARY_SORTS: readonly OrgTemplateSort[] = ["uses", "recent", "name"];

/** Cột của dòng từ `md`: tên | cấu trúc | lượt dùng | ngày lưu | menu. Dưới `md` các ô xếp dưới tên. */
export const LIBRARY_ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_200px_120px_120px_32px] md:items-center md:gap-4";
export const LIBRARY_ROW_CLASS = `relative flex flex-col gap-2 ${LIBRARY_ROW_GRID}`;
export const LIBRARY_SKELETON_ROWS = 6;

/**
 * Khung trang Thư viện mẫu: vùng cuộn, tiêu đề + số mẫu, nút "Tải mẫu mới" (Lead), đoạn giới thiệu, ghi chú chỉ xem
 * (không phải Lead). Trang thật và khung chờ đăng nhập (`ShellSkeleton`) cùng dựng từ đây ⇒ lúc tải lại, hình trùng nhau.
 */
export default function LibraryShell({
  scrollRef,
  count,
  role,
  uploadDisabled = false,
  onUpload,
  alert,
  children,
}: {
  scrollRef?: (el: HTMLDivElement | null) => void;
  /** Tổng số mẫu (không tìm); chưa biết ⇒ `undefined`, không hiện số. */
  count?: number;
  /** Vai trò trong tổ chức; `null` khi chưa biết (chưa hiện nút Lead lẫn ghi chú chỉ xem). */
  role: OrgRole | null;
  uploadDisabled?: boolean;
  onUpload: () => void;
  alert?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("app.org.library");
  const isLead = role === "lead";
  return (
    // AppShell khoá chiều cao ⇒ trang tự có vùng cuộn. Không đặt padding trên ở vùng cuộn: `sticky top-0` tính từ mép
    // trong của padding nên thanh tìm sẽ treo lơ lửng, lộ dòng cuộn qua phía trên — đệm trên nằm ở khối bên trong.
    <div ref={scrollRef} className={`flex-1 overflow-y-auto overflow-x-hidden pb-scroll-end bg-surface-container-lowest ${PAGE_GUTTER}`}>
      <div className="w-full max-w-[1200px] mx-auto pt-6 sm:pt-8 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
            {/* Số đếm là tổng của tổ chức — đang tìm thì số kết quả nằm ở thanh tìm */}
            {count !== undefined && count > 0 && <CountBadge count={count} />}
            {isLead && (
              <Button size="sm" className="ml-auto" disabled={uploadDisabled} onClick={onUpload}>
                <Icon name="upload" size={15} />
                {t("templates.newTemplate")}
              </Button>
            )}
          </div>
          <p className="text-body text-on-surface-muted leading-[1.6] max-w-[720px]">{t("intro")}</p>
          {role !== null && !isLead && (
            <p className="self-start inline-flex items-center gap-2 rounded-control bg-surface-container-low px-3 py-2 text-body text-on-surface-variant">
              <Icon name="info" size={15} className="shrink-0 text-on-surface-muted" />
              {t("readOnly")}
            </p>
          )}
        </header>
        {alert}
        {children}
      </div>
    </div>
  );
}

/** Thanh tìm + sắp xếp dính ở đầu vùng cuộn (trang thật và khung chờ dùng chung). */
export function LibraryToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  resultCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: OrgTemplateSort;
  onSortChange: (value: OrgTemplateSort) => void;
  /** Số kết quả khi đang tìm; `null` ⇒ không hiện. */
  resultCount: number | null;
}) {
  const t = useTranslations("app.org.library");
  return (
    // Danh sách dài cuộn qua bên dưới, thanh không bị cuộn mất. z trên nút ⋮ của dòng; -mt-3 bù đệm trên để lúc chưa dính
    // khoảng cách với đoạn giới thiệu không đổi.
    <div className={`sticky top-0 z-30 -mt-3 py-3 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center gap-2 ${STICKY_BLEED} ${STICKY_FADE}`}>
      <SearchInput value={query} onChange={onQueryChange} label={t("templates.searchLabel")} placeholder={t("templates.searchPlaceholder")} className="sm:w-[320px]" />
      {resultCount !== null && (
        <span className="text-body text-on-surface-muted tabular-nums" aria-live="polite">
          {t("templates.results", { count: resultCount })}
        </span>
      )}
      <FilterSelect
        label={t("templates.sortLabel")}
        value={sort}
        onChange={onSortChange}
        options={LIBRARY_SORTS.map((value) => ({ value, label: t(`templates.sort.${value}`) }))}
        className="sm:ml-auto self-start"
      />
    </div>
  );
}

/** Hàng tiêu đề cột — chỉ có khi các ô thẳng cột (từ `md`). */
export function LibraryColumnHeader() {
  const t = useTranslations("app.org.library");
  return (
    <div aria-hidden className={`hidden ${LIBRARY_ROW_GRID} px-3 pt-1.5 pb-2 text-caption font-semibold text-on-surface-muted`}>
      <span className="pl-12">{t("templates.cols.name")}</span>
      <span>{t("templates.cols.structure")}</span>
      <span>{t("templates.cols.uses")}</span>
      <span>{t("templates.cols.saved")}</span>
      <span />
    </div>
  );
}

/** Dòng giữ chỗ cùng hình dòng thật: icon file (cố định) + tên / tên file / nhãn phiên bản, ba ô meta, chỗ nút ⋮. */
export function LibraryRowSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <span aria-hidden className="size-9 shrink-0 rounded-control bg-primary-soft text-primary flex items-center justify-center">
          <Icon name="file" size={17} />
        </span>
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="contents max-md:flex max-md:gap-3 max-md:pl-12">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <span className="hidden md:block" />
    </>
  );
}

const noop = () => undefined;

/** Trang Thư viện lúc đang tải lần đầu, dùng cho khung chờ đăng nhập. */
export function LibraryLoading({ role }: { role: OrgRole | null }) {
  const t = useTranslations("app.org.library");
  return (
    <LibraryShell role={role} onUpload={noop}>
      <section aria-label={t("title")} className="flex flex-col gap-3">
        <LibraryToolbar query="" onQueryChange={noop} sort="uses" onSortChange={noop} resultCount={null} />
        <DataListSkeleton
          header={<LibraryColumnHeader />}
          rowClassName={LIBRARY_ROW_CLASS}
          rows={LIBRARY_SKELETON_ROWS}
          label={t("loading")}
          renderSkeletonRow={LibraryRowSkeleton}
        />
      </section>
    </LibraryShell>
  );
}
